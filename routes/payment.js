import express from 'express';
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

// Process payment
router.post('/process', authenticateToken, async (req, res) => {
  const { customerIds, amount, paymentMethod, yearswithcustomers, customerAsstYears } = req.body;
  console.log("asst year", req.body);
  console.log("customer asst year", customerAsstYears[customerIds]);
  console.log("customerIds", customerIds);


  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0 || !amount || !paymentMethod) {
    return res.status(400).json({ message: 'Customer IDs array, amount, and payment method are required' });
  }


  if (!['wallet', 'razorpay'].includes(paymentMethod)) {
    return res.status(400).json({ message: 'Invalid payment method' });
  }

  try {
    // Check if all customers exist and belong to agent
    const placeholders = customerIds.map(() => '?').join(',');
    const [customerRows] = await pool.query(
      `SELECT id FROM customer WHERE id IN (${placeholders}) AND agent_id = ?`,
      [...customerIds, req.agentId]
    );

    if (customerRows.length !== customerIds.length) {
      return res.status(404).json({ message: 'Some customers not found or do not belong to you' });
    }

    if (paymentMethod === 'wallet') {
      // Start transaction for wallet payment
      await pool.query('START TRANSACTION');

      try {
        // Check agent balance with lock
        const [agentRows] = await pool.query(
          'SELECT wbalance, file_charge FROM agent WHERE id = ? FOR UPDATE',
          [req.agentId]
        );

        if (agentRows.length === 0) {
          await pool.query('ROLLBACK');
          return res.status(404).json({ message: 'Agent not found' });
        }

        const currentBalance = parseFloat(agentRows[0].wbalance) || 0;
        const fileCharge = parseFloat(agentRows[0].file_charge) || 0;

        let totalAmountToDeduct = 0;
        const customerPaymentsBreakdown = [];

        // Calculate breakdown for each customer
        for (const customerId of customerIds) {
          // Get customer income_slab
          const [customerRows] = await pool.query('SELECT income_slab FROM customer WHERE id = ?', [customerId]);
          const income_slab = customerRows[0]?.income_slab;
          const asstYear = (customerAsstYears && customerAsstYears[customerId]) ||
            (yearswithcustomers && yearswithcustomers[customerIds.indexOf(customerId)]) ||
            '2025-26';

          // Get penalty from ratecard
          const [rateRows] = await pool.query(
            `SELECT penalty_amount FROM ratecard 
             WHERE income_slab = ? AND assessment_year = ? 
             AND CURDATE() BETWEEN calendar_from AND calendar_to LIMIT 1`,
            [income_slab, asstYear]
          );
          const penalty = rateRows.length > 0 ? parseFloat(rateRows[0].penalty_amount) : 0;
          const individualAmount = fileCharge + penalty;

          totalAmountToDeduct += individualAmount;
          customerPaymentsBreakdown.push({
            customerId,
            amount: individualAmount,
            asstYear
          });
        }

        if (currentBalance < totalAmountToDeduct) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ message: `Insufficient wallet balance. Required: ₹${totalAmountToDeduct}, Available: ₹${currentBalance}` });
        }

        // Deduct from wallet
        await pool.query(
          'UPDATE agent SET wbalance = wbalance - ? WHERE id = ?',
          [totalAmountToDeduct, req.agentId]
        );

        let runningBalance = currentBalance;

        // Create individual records for each customer
        for (const paymentData of customerPaymentsBreakdown) {
          const [paymentResult] = await pool.query(
            `INSERT INTO payment (agent_id, customer_id, amount, paid, payment_method, asst_year) 
             VALUES (?, ?, ?, TRUE, ?, ?)`,
            [req.agentId, paymentData.customerId, paymentData.amount, paymentMethod, paymentData.asstYear]
          );

          const balanceBefore = runningBalance;
          const balanceAfter = runningBalance - paymentData.amount;
          runningBalance = balanceAfter;

          // Transaction record for each customer
          await pool.query(
            `INSERT INTO wallet_transactions 
             (agent_id, performed_by, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.agentId, req.agentId, 'debit', paymentData.amount, balanceBefore, balanceAfter, 'itr_payment', paymentResult.insertId, `ITR Payment for ${paymentData.asstYear}`]
          );
        }

        await pool.query('COMMIT');
        res.json({ message: 'Payment processed successfully via wallet', totalDeducted: totalAmountToDeduct });
      } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error during wallet payment transaction:', error);
        res.status(500).json({ message: 'Payment processing failed in transaction' });
      }
    } else if (paymentMethod === 'razorpay') {
      // For Razorpay, we'll create pending payment records using the breakdown
      const [agentRows] = await pool.query('SELECT file_charge FROM agent WHERE id = ?', [req.agentId]);
      const fileCharge = parseFloat(agentRows[0]?.file_charge || 0);

      const paymentRecords = [];
      for (const customerId of customerIds) {
        const [customerRows] = await pool.query('SELECT income_slab FROM customer WHERE id = ?', [customerId]);
        const income_slab = customerRows[0]?.income_slab;
        const asstYear = (customerAsstYears && customerAsstYears[customerId]) ||
          (yearswithcustomers && yearswithcustomers[customerIds.indexOf(customerId)]) ||
          '2025-26';

        const [rateRows] = await pool.query(
          `SELECT penalty_amount FROM ratecard 
           WHERE income_slab = ? AND assessment_year = ? 
           AND CURDATE() BETWEEN calendar_from AND calendar_to LIMIT 1`,
          [income_slab, asstYear]
        );
        const penalty = rateRows.length > 0 ? parseFloat(rateRows[0].penalty_amount) : 0;
        const individualAmount = fileCharge + penalty;

        const [result] = await pool.query(
          `INSERT INTO payment (agent_id, customer_id, amount, paid, payment_method, asst_year) 
           VALUES (?, ?, ?, FALSE, ?, ?)`,
          [req.agentId, customerId, individualAmount, paymentMethod, asstYear]
        );
        paymentRecords.push(result.insertId);
      }

      res.json({
        message: 'Payment initiated via Razorpay',
        paymentIds: paymentRecords
      });
    }

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ message: 'Failed to process payment' });
  }
});

// Complete Razorpay payment
router.post('/complete-razorpay', authenticateToken, async (req, res) => {
  const { paymentIds, razorpayPaymentId, asstYears } = req.body;

  if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0 || !razorpayPaymentId) {
    return res.status(400).json({ message: 'Payment IDs array and Razorpay payment ID are required' });
  }

  try {
    // Update payment records to mark as paid
    const placeholders = paymentIds.map(() => '?').join(',');
    const [result] = await pool.query(
      `UPDATE payment SET paid = TRUE WHERE id IN (${placeholders}) AND agent_id = ?`,
      [...paymentIds, req.agentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No payment records found' });
    }

    // Get customer IDs from payment records
    const [paymentRows] = await pool.query(
      `SELECT customer_id FROM payment WHERE id IN (${placeholders}) AND agent_id = ?`,
      [...paymentIds, req.agentId]
    );

    const customerIds = paymentRows.map(row => row.customer_id);

    // Automatically send paid customers to subadmin if asstYears provided
    if (asstYears && Array.isArray(asstYears) && asstYears.length === customerIds.length) {
      const customersWithYears = customerIds.map((customerId, index) => ({
        customerId,
        asstYear: asstYears[index]
      }));

      const newEntries = [];
      const alreadySent = [];

      for (const item of customersWithYears) {
        const { customerId, asstYear } = item;

        // Check if already sent for this assessment year
        const [existing] = await pool.query(
          `SELECT id FROM itr WHERE customer_id = ? AND agent_id = ? AND asst_year = ?`,
          [customerId, req.agentId, asstYear]
        );

        if (existing.length > 0) {
          alreadySent.push({ customerId, asstYear });
          continue;
        }

        newEntries.push({ customerId, asstYear });
      }

      if (newEntries.length > 0) {
        // Insert new records into itr table
        for (const entry of newEntries) {
          const [result] = await pool.query(
            `INSERT INTO itr (customer_id, asst_year, agent_id, agentedit, status) VALUES (?, ?, ?, ?, ?)`,
            [entry.customerId, entry.asstYear, req.agentId, false, 'Pending']
          );

          const itrId = result.insertId;

          // Initialize flow tracking for each ITR
          await pool.query(
            'INSERT INTO itr_flow (itr_id, customer_id, itr_date) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [itrId, entry.customerId]
          );
        }

        // Update subadmin_send to true for sent customers
        const newCustomerIds = newEntries.map(entry => entry.customerId);
        const updatePlaceholders = newCustomerIds.map(() => '?').join(',');
        await pool.query(
          `UPDATE customer SET subadmin_send = TRUE WHERE id IN (${updatePlaceholders}) AND agent_id = ?`,
          [...newCustomerIds, req.agentId]
        );
      }
    }

    res.json({ message: 'Payment completed successfully' });

  } catch (error) {
    console.error('Error completing Razorpay payment:', error);
    res.status(500).json({ message: 'Failed to complete payment' });
  }
});

// Get payment history for agent
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, c.name as customer_name, c.pan_number
      FROM payment p
      JOIN customer c ON p.customer_id = c.id
      WHERE p.agent_id = ?
      ORDER BY p.created_at DESC
    `, [req.agentId]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
});

// Check payment status for a customer
router.get('/check-status/:customerId', authenticateToken, async (req, res) => {
  const { customerId } = req.params;

  try {
    // Check if customer exists and belongs to agent
    const [customerRows] = await pool.query(
      'SELECT id FROM customer WHERE id = ? AND agent_id = ?',
      [customerId, req.agentId]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if payment exists and is paid
    const [paymentRows] = await pool.query(
      'SELECT paid,asst_year FROM payment WHERE customer_id = ? AND agent_id = ?',
      [customerId, req.agentId]
    );

    const hasPaid = paymentRows.length > 0 && paymentRows[0].paid;
    console.log(paymentRows);

    res.json({ paymentRows });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ message: 'Failed to check payment status' });
  }
});

// Get agent wallet balance
router.get('/wallet-balance', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT wbalance FROM agent WHERE id = ?',
      [req.agentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({ balance: rows[0].wbalance || 0 });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ message: 'Failed to fetch wallet balance' });
  }
});

// Get full history (payments and rejections) for a specific ITR
router.get('/itr-history/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;

  try {
    // 1. Get ITR details
    const [itrRows] = await pool.query(
      'SELECT customer_id, agent_id, asst_year, created_at FROM itr WHERE id = ?',
      [itrId]
    );

    if (itrRows.length === 0) {
      return res.status(404).json({ message: 'ITR not found' });
    }

    const { customer_id, agent_id, asst_year, created_at: itr_created_at } = itrRows[0];

    // 2. Get all payments for this customer & asst_year
    const [paymentRows] = await pool.query(
      'SELECT id, amount, paid, payment_method, created_at, "payment" as type FROM payment WHERE customer_id = ? AND agent_id = ? AND asst_year = ?',
      [customer_id, agent_id, asst_year]
    );

    // 3. Get all rejections for this ITR
    const [rejectionRows] = await pool.query(
      'SELECT id, reason, extra_charge, rejected_by_type, created_at, "rejection" as type FROM itr_rejection_history WHERE itr_id = ?',
      [itrId]
    );

    // Combine and sort by date
    const history = [...paymentRows, ...rejectionRows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    res.json({
      itrDetails: { itrId, customer_id, agent_id, asst_year, itr_created_at },
      history
    });
  } catch (error) {
    console.error('Error fetching ITR history:', error);
    res.status(500).json({ message: 'Failed to fetch ITR history' });
  }
});

export default router;
