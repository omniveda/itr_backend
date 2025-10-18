import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

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

// Create customer
router.post('/', authenticateToken, async (req, res) => {
  const {
    name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
    tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type,
    last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3,
    attachments_4, attachments_5, file_charge, income_slab, comment_box, customer_type
  } = req.body;

  if (!name || !mobile_no || !pan_number) {
    return res.status(400).json({ message: 'Name, mobile number, and PAN number are required' });
  }

  try {
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const [result] = await pool.query(
      `INSERT INTO customer (
        name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
        tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type,
        last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3,
        attachments_4, attachments_5, file_charge, income_slab, comment_box, customer_type, agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
        tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type,
        last_ay_income, profile_photo, user_id, hashedPassword, attachments_1, attachments_2, attachments_3,
        attachments_4, attachments_5, file_charge, income_slab, comment_box, customer_type, req.agentId
      ]
    );
    res.status(201).json({ message: 'Customer added successfully', customerId: result.insertId });
  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({ message: 'Failed to add customer' });
  }
});

// Get all customers for the agent
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customer WHERE agent_id = ?', [req.agentId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

// Get customer by ID
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM customer WHERE id = ? AND agent_id = ?', [id, req.agentId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: 'Failed to fetch customer' });
  }
});

// Update customer
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove password if empty
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  } else {
    delete updates.password;
  }

  const fields = Object.keys(updates);
  const values = Object.values(updates);

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const setClause = fields.map(field => `${field} = ?`).join(', ');

  try {
    const [result] = await pool.query(
      `UPDATE customer SET ${setClause} WHERE id = ? AND agent_id = ?`,
      [...values, id, req.agentId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM customer WHERE id = ? AND agent_id = ?', [id, req.agentId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ message: 'Failed to delete customer' });
  }
});

// Send selected customers to subadmin
router.post('/send-to-subadmin', authenticateToken, async (req, res) => {
  const { customerIds } = req.body;

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return res.status(400).json({ message: 'Customer IDs are required' });
  }

  try {
    // Verify that all customers belong to the agent
    const placeholders = customerIds.map(() => '?').join(',');
    const [customers] = await pool.query(
      `SELECT id FROM customer WHERE id IN (${placeholders}) AND agent_id = ?`,
      [...customerIds, req.agentId]
    );

    if (customers.length !== customerIds.length) {
      return res.status(400).json({ message: 'Some customers not found or do not belong to you' });
    }

    // Check which customers have already been sent
    const [existing] = await pool.query(
      `SELECT customer_id FROM subadmin_itr WHERE customer_id IN (${placeholders}) AND agent_id = ?`,
      [...customerIds, req.agentId]
    );

    const alreadySentIds = existing.map(row => row.customer_id);
    const newCustomerIds = customerIds.filter(id => !alreadySentIds.includes(id));

    if (newCustomerIds.length === 0) {
      return res.status(400).json({ message: 'All selected customers have already been sent to subadmin' });
    }

    // Insert new records into subadmin_itr table
    const values = newCustomerIds.map(customerId => [customerId, req.agentId]);
    const placeholdersInsert = values.map(() => '(?, ?)').join(',');
    const flatValues = values.flat();

    await pool.query(
      `INSERT INTO subadmin_itr (customer_id, agent_id) VALUES ${placeholdersInsert}`,
      flatValues
    );

    // Update subadmin_send to true for sent customers
    const updatePlaceholders = newCustomerIds.map(() => '?').join(',');
    await pool.query(
      `UPDATE customer SET subadmin_send = TRUE WHERE id IN (${updatePlaceholders}) AND agent_id = ?`,
      [...newCustomerIds, req.agentId]
    );

    res.json({
      message: `${newCustomerIds.length} customer(s) sent to subadmin successfully`,
      sentCount: newCustomerIds.length,
      alreadySentCount: alreadySentIds.length
    });
  } catch (error) {
    console.error('Error sending customers to subadmin:', error);
    res.status(500).json({ message: 'Failed to send customers to subadmin' });
  }
});

// Get customers sent to subadmin (for subadmin view)
router.get('/sent-to-subadmin', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, si.sent_at, a.name as agent_name
      FROM subadmin_itr si
      JOIN customer c ON si.customer_id = c.id
      JOIN agent a ON si.agent_id = a.id
      ORDER BY si.sent_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sent customers:', error);
    res.status(500).json({ message: 'Failed to fetch sent customers' });
  }
});

export default router;
