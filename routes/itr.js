import express from 'express';
import { pool } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.agentId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get all ITR entries for the agent
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT itr.*, customer.name as customer_name, customer.mobile_no as customer_mobile_no, customer.pan_number as customer_pan
      FROM itr
      JOIN customer ON itr.customer_id = customer.id
      WHERE itr.agent_id = ?
    `, [req.agentId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ITR entries:', error);
    res.status(500).json({ message: 'Failed to fetch ITR entries' });
  }
});

// Create new ITR entry
router.post('/', authenticateToken, async (req, res) => {
  const { customer_id, asst_year, status } = req.body;

  if (!customer_id || !asst_year) {
    return res.status(400).json({ message: 'Customer ID and assessment year are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO itr (customer_id, asst_year, agent_id, agentedit, status) VALUES (?, ?, ?, ?, ?)`,
      [customer_id, asst_year, req.agentId, false, status || 'Pending']
    );

    const itrId = result.insertId;

    // Initialize flow tracking
    await pool.query(
      'INSERT INTO itr_flow (itr_id, customer_id, itr_date) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [itrId, customer_id]
    );

    res.status(201).json({ message: 'ITR added successfully', itrId: itrId });
  } catch (error) {
    console.error('Error adding ITR:', error);
    res.status(500).json({ message: 'Failed to add ITR' });
  }
});

// Update ITR entry
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Check if agentedit is true for this ITR
    const [rows] = await pool.query('SELECT agentedit FROM itr WHERE id = ? AND agent_id = ?', [id, req.agentId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ITR not found' });
    }
    if (!rows[0].agentedit) {
      return res.status(403).json({ message: 'Edit not allowed for this ITR' });
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');

    const [result] = await pool.query(
      `UPDATE itr SET ${setClause} WHERE id = ? AND agent_id = ?`,
      [...values, id, req.agentId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ITR not found' });
    }

    // Reset agentedit to 0 after successful update
    await pool.query('UPDATE itr SET agentedit = 0 WHERE id = ? AND agent_id = ?', [id, req.agentId]);

    res.json({ message: 'ITR updated successfully' });
  } catch (error) {
    console.error('Error updating ITR:', error);
    res.status(500).json({ message: 'Failed to update ITR' });
  }
});

// POST /api/itr/reapply-with-wallet
// Allows agent to pay extra charge and reapply for a rejected ITR
router.post('/reapply-with-wallet', authenticateToken, async (req, res) => {
  const { itrId } = req.body;

  if (!itrId) {
    return res.status(400).json({ message: 'ITR ID is required' });
  }

  try {
    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // 1. Fetch ITR and check if it's rejected and has extra_charge
      const [itrRows] = await pool.query(
        'SELECT id, status, extra_charge, customer_id, asst_year FROM itr WHERE id = ? AND agent_id = ? FOR UPDATE',
        [itrId, req.agentId]
      );

      if (itrRows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ message: 'ITR not found' });
      }

      const itr = itrRows[0];
      if (itr.status !== 'Rejected') {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Only rejected ITRs can be reapplied' });
      }

      const amountToPay = parseFloat(itr.extra_charge) || 0;
      if (amountToPay <= 0) {
        // If no extra charge, just reset status (though this flow usually implies payment)
        await pool.query('UPDATE itr SET status = "Pending", Comment = NULL, ca_id = NULL, ca_send = 0 WHERE id = ?', [itrId]);
        // Also remove from ca_itr assignment
        await pool.query('DELETE FROM ca_itr WHERE itr_id = ?', [itrId]);
        await pool.query('DELETE FROM subadmin_itr WHERE itr_id = ?', [itrId]);

        await pool.query('COMMIT');
        return res.json({ message: 'ITR reapplied successfully (no charge required)' });
      }

      // 2. Check and deduct from agent wallet
      const [agentRows] = await pool.query('SELECT wbalance FROM agent WHERE id = ? FOR UPDATE', [req.agentId]);
      const currentBalance = parseFloat(agentRows[0].wbalance) || 0;

      if (currentBalance < amountToPay) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Insufficient wallet balance' });
      }

      const balanceAfter = currentBalance - amountToPay;
      await pool.query('UPDATE agent SET wbalance = ? WHERE id = ?', [balanceAfter, req.agentId]);

      // 3. Update ITR table (Reset status and clear CA assignment)
      await pool.query('UPDATE itr SET status = "Pending", Comment = NULL, extra_charge = NULL, ca_id = NULL, ca_send = 0 WHERE id = ?', [itrId]);

      // Also remove from ca_itr assignment to allow re-assignment by subadmin
      await pool.query('DELETE FROM ca_itr WHERE itr_id = ?', [itrId]);
      await pool.query('DELETE FROM subadmin_itr WHERE itr_id = ?', [itrId]);

      // 4. Log in payment table
      const [paymentResult] = await pool.query(
        `INSERT INTO payment (agent_id, customer_id, amount, paid, payment_method, asst_year) 
         VALUES (?, ?, ?, TRUE, ?, ?)`,
        [req.agentId, itr.customer_id, amountToPay, 'wallet', itr.asst_year]
      );

      // 5. Log in wallet_transactions table
      await pool.query(
        `INSERT INTO wallet_transactions 
         (agent_id, performed_by, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.agentId, req.agentId, 'debit', amountToPay, currentBalance, balanceAfter, 'itr_extra_charge', paymentResult.insertId, `Extra Charge for ITR Reapplication (ITR ID: ${itrId})`]
      );

      await pool.query('COMMIT');
      res.json({ message: 'ITR reapplied successfully. Extra charge paid from wallet.', balanceAfter });

    } catch (innerError) {
      await pool.query('ROLLBACK');
      throw innerError;
    }

  } catch (error) {
    console.error('Error in reapply-with-wallet:', error);
    res.status(500).json({ message: 'Failed to reapply and pay extra charge' });
  }
});

export default router;
