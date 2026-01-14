import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to check superadmin
const requireSuperadmin = (req, res, next) => {
  if (!req.user.issuperadmin) {
    return res.status(403).json({ message: 'Access denied. Superadmin only.' });
  }
  next();
};

// ===== AGENT WALLET ENDPOINTS =====

// GET /api/agent/wallet/balance - Get current wallet balance
router.get('/agent/balance', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    console.log("agetnId", agentId);
    const [rows] = await pool.query(
      'SELECT id, wbalance FROM agent WHERE id = ?',
      [agentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    const wallet = rows[0];
    res.json({
      balance: wallet.wbalance,
      status: 'active',
      agentId: wallet.id
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ message: 'Failed to fetch wallet balance' });
  }
});

// GET /api/agent/wallet/transactions - Get transaction history with filters
router.get('/agent/transactions', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { page = 1, limit = 10, searchTerm, transactionType, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE wt.agent_id = ?';
    const queryParams = [agentId];

    if (searchTerm) {
      whereClause += ` AND (
        c.name LIKE ? OR 
        c.pan_number LIKE ? OR 
        c.mobile_no LIKE ? OR 
        wt.description LIKE ? OR 
        wt.reference_id LIKE ?
      )`;
      const searchPattern = `%${searchTerm}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (transactionType && (transactionType === 'credit' || transactionType === 'debit')) {
      whereClause += ' AND wt.transaction_type = ?';
      queryParams.push(transactionType);
    }

    if (startDate) {
      whereClause += ' AND wt.created_at >= ?';
      queryParams.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      whereClause += ' AND wt.created_at <= ?';
      queryParams.push(`${endDate} 23:59:59`);
    }

    // Get transactions with pagination
    const [transactions] = await pool.query(
      `SELECT wt.*, p.asst_year, p.customer_id,
              c.name as customer_name, c.pan_number as customer_pan, c.mobile_no as customer_mobile,
              CASE 
                WHEN wt.reference_type = 'itr_payment' THEN CONCAT('ITR Payment (', p.asst_year, ')') 
                WHEN wt.reference_type = 'itr_extra_charge' THEN CONCAT('Extra Charge Reapply (', p.asst_year, ')')
                ELSE wt.description 
              END as display_description
       FROM wallet_transactions wt
       LEFT JOIN payment p ON wt.reference_id = p.id AND (wt.reference_type = 'itr_payment' OR wt.reference_type = 'itr_extra_charge')
       LEFT JOIN customer c ON p.customer_id = c.id
       ${whereClause}
       ORDER BY wt.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );

    // Get total count with filters
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM wallet_transactions wt
       LEFT JOIN payment p ON wt.reference_id = p.id AND (wt.reference_type = 'itr_payment' OR wt.reference_type = 'itr_extra_charge')
       LEFT JOIN customer c ON p.customer_id = c.id
       ${whereClause}`,
      queryParams
    );

    res.json({
      transactions,
      total: countRows[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

// POST /api/agent/wallet/pay-itr - Deduct amount for ITR payment
router.post('/agent/pay-itr', authenticateToken, async (req, res) => {
  const { itrId, amount } = req.body;
  const agentId = req.user.id;

  if (!itrId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid ITR ID or amount' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify ITR belongs to agent
    const [itrRows] = await connection.query(
      'SELECT id, agent_id FROM itr WHERE id = ? AND agent_id = ?',
      [itrId, agentId]
    );

    if (itrRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'ITR not found or does not belong to this agent' });
    }

    // Check if already paid
    const [paymentCheck] = await connection.query(
      'SELECT id FROM itr_payments WHERE itr_id = ? AND payment_status = "completed"',
      [itrId]
    );

    if (paymentCheck.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'This ITR has already been paid' });
    }

    // Get agent balance from agent table
    const [agentRows] = await connection.query(
      'SELECT wbalance FROM agent WHERE id = ?',
      [agentId]
    );

    if (agentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Agent not found' });
    }

    const balanceBefore = parseFloat(agentRows[0].wbalance || 0);
    if (balanceBefore < amount) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Insufficient wallet balance',
        currentBalance: balanceBefore,
        requiredAmount: amount
      });
    }

    const balanceAfter = (balanceBefore - parseFloat(amount));

    // Insert debit transaction (associate with agent_id)
    const [txnResult] = await connection.query(
      `INSERT INTO wallet_transactions 
       (agent_id, performed_by, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agentId, agentId, 'debit', amount, balanceBefore, balanceAfter, 'itr_payment', itrId, 'ITR Payment']
    );

    // Create ITR payment record
    await connection.query(
      `INSERT INTO itr_payments (itr_id, agent_id, wallet_transaction_id, amount, payment_status)
       VALUES (?, ?, ?, ?, 'completed')`,
      [itrId, agentId, txnResult.insertId, amount]
    );

    // Update agent table wbalance
    await connection.query(
      'UPDATE agent SET wbalance = ? WHERE id = ?',
      [balanceAfter, agentId]
    );

    await connection.commit();

    res.json({
      message: 'ITR payment successful',
      newBalance: balanceAfter,
      transactionId: txnResult.insertId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error processing ITR payment:', error);
    res.status(500).json({ message: 'Failed to process payment' });
  } finally {
    connection.release();
  }
});

// ===== SUPERADMIN WALLET ENDPOINTS =====

// POST /api/superadmin/wallet/recharge - Recharge agent wallet
router.post('/superadmin/recharge', authenticateToken, requireSuperadmin, async (req, res) => {
  const { agentId, amount, description } = req.body;
  const superadminId = req.user.id;

  if (!agentId || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid agent ID or amount' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify agent exists
    const [agentRows] = await connection.query(
      'SELECT id FROM agent WHERE id = ?',
      [agentId]
    );

    if (agentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Get current agent balance
    const [agentBalanceRows] = await connection.query(
      'SELECT wbalance FROM agent WHERE id = ?',
      [agentId]
    );

    const balanceBefore = parseFloat(agentBalanceRows[0]?.wbalance || 0);
    const balanceAfter = balanceBefore + parseFloat(amount);

    // Insert credit transaction associated with agent_id; performed_by will be superadmin
    const [txnResult] = await connection.query(
      `INSERT INTO wallet_transactions 
       (agent_id, performed_by, transaction_type, amount, balance_before, balance_after, reference_type, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [agentId, superadminId, 'credit', amount, balanceBefore, balanceAfter, 'recharge', description || 'Wallet Recharge']
    );

    // Update agent wbalance
    await connection.query(
      'UPDATE agent SET wbalance = ? WHERE id = ?',
      [balanceAfter, agentId]
    );

    await connection.commit();

    res.json({
      message: 'Wallet recharged successfully',
      agentId,
      newBalance: balanceAfter,
      transactionId: txnResult.insertId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error recharging wallet:', error);
    res.status(500).json({ message: 'Failed to recharge wallet' });
  } finally {
    connection.release();
  }
});

// GET /api/superadmin/wallets - Get all agent wallets
router.get('/superadmin/wallets', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Return agent list with wallet balances from agent.wbalance
    const [wallets] = await pool.query(
      `SELECT a.id as id, a.id as agent_id, a.name, a.mail_id, a.wbalance as balance, 'active' as status
       FROM agent a
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM agent');

    res.json({
      wallets,
      total: countRows[0].total,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ message: 'Failed to fetch wallets' });
  }
});

// GET /api/superadmin/wallet/:agentId/transactions - Get specific agent transactions
router.get('/superadmin/wallet/:agentId/transactions', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    let { page = 1, limit = 10, transactionType, startDate, endDate } = req.query;

    // Handle "all" limit for PDF export
    if (limit === 'all') {
      limit = 1000000;
    } else {
      limit = parseInt(limit);
    }

    page = parseInt(page);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE wt.agent_id = ?';
    const queryParams = [agentId];

    if (transactionType && (transactionType === 'credit' || transactionType === 'debit')) {
      whereClause += ' AND wt.transaction_type = ?';
      queryParams.push(transactionType);
    }

    if (startDate) {
      whereClause += ' AND wt.created_at >= ?';
      queryParams.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      whereClause += ' AND wt.created_at <= ?';
      queryParams.push(`${endDate} 23:59:59`);
    }

    // Get transactions by agent_id
    const [transactions] = await pool.query(
      `SELECT wt.*, 
              CASE WHEN wt.reference_type = 'itr_payment' 
                   THEN CONCAT('ITR Payment (', i.asst_year, ')') 
                   ELSE 'Wallet Recharge' 
              END as description
       FROM wallet_transactions wt
       LEFT JOIN itr i ON wt.reference_id = i.id AND wt.reference_type = 'itr_payment'
       ${whereClause}
       ORDER BY wt.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM wallet_transactions wt ${whereClause}`,
      queryParams
    );

    res.json({
      transactions,
      total: countRows[0].total,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching agent transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

export default router;
