import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { pool } from '../db.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only .png, .jpg, .jpeg and .pdf files are allowed!'));
    }
  }
});

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

// Create customer with file uploads
router.post('/', authenticateToken, upload.fields([
  { name: 'attachments_1', maxCount: 1 },
  { name: 'attachments_2', maxCount: 1 },
  { name: 'attachments_3', maxCount: 1 },
  { name: 'attachments_4', maxCount: 1 },
  { name: 'attachments_5', maxCount: 1 },
  { name: 'attachments_6', maxCount: 1 }
]), async (req, res) => {
  const {
    name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
    tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type,
    last_ay_income, profile_photo, user_id, password, file_charge, income_slab, comment_box, customer_type
  } = req.body;

  if (!name || !mobile_no || !pan_number) {
    return res.status(400).json({ message: 'Name, mobile number, and PAN number are required' });
  }

  try {
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    // Get uploaded file paths
    const attachments = {};
    for (let i = 1; i <= 6; i++) {
      if (req.files && req.files[`attachments_${i}`] && req.files[`attachments_${i}`][0]) {
        attachments[`attachments_${i}`] = req.files[`attachments_${i}`][0].filename;
      } else {
        attachments[`attachments_${i}`] = null;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO customer (
        name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
        tds_amount, itr_password, income_type, mobile_no, mail_id, filling_type,
        last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3,
        attachments_4, attachments_5, attachments_6, income_slab, comment_box, customer_type, agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
        tds_amount, itr_password, income_type, mobile_no, mail_id, filling_type,
        last_ay_income, profile_photo, user_id, hashedPassword, attachments.attachments_1, attachments.attachments_2, attachments.attachments_3,
        attachments.attachments_4, attachments.attachments_5, attachments.attachments_6, income_slab, comment_box, customer_type, req.agentId
      ]
    );
    res.status(201).json({ message: 'Customer added successfully', customerId: result.insertId });
  } catch (error) {
    console.error('Error adding customer:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'PAN number already exists. Please use a unique PAN number.' });
    }
    res.status(500).json({ message: 'Failed to add customer' });
  }
});

// Create customer with wallet payment and file uploads
router.post('/with-payment', authenticateToken, upload.fields([
  { name: 'attachments_1', maxCount: 1 },
  { name: 'attachments_2', maxCount: 1 },
  { name: 'attachments_3', maxCount: 1 },
  { name: 'attachments_4', maxCount: 1 },
  { name: 'attachments_5', maxCount: 1 },
  { name: 'attachments_6', maxCount: 1 }
]), async (req, res) => {
  const { paymentMethod, ...customerData } = req.body;

  console.log('Customer data:', customerData);
  console.log('Payment method:', paymentMethod);

  if (paymentMethod !== 'wallet') {
    return res.status(400).json({ message: 'This endpoint only supports wallet payment' });
  }

  const amount = parseFloat(customerData.file_charge || 0);
  console.log('Processing wallet payment of amount:', amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Valid file charge is required' });
  }

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const year = `${currentYear}-${nextYear.toString().slice(-2)}`;

  if (!customerData.name || !customerData.mobile_no || !customerData.pan_number) {
    return res.status(400).json({ message: 'Name, mobile number, and PAN number are required' });
  }

  try {
    await pool.query('START TRANSACTION');

    // Check agent balance
    const [agentRows] = await pool.query(
      'SELECT wbalance FROM agent WHERE id = ? FOR UPDATE',
      [req.agentId]
    );


    if (agentRows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Agent not found' });
    }

    const currentBalance = agentRows[0].wbalance || 0;

    if (currentBalance < amount) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Deduct from wallet
    await pool.query(
      'UPDATE agent SET wbalance = wbalance - ? WHERE id = ?',
      [amount, req.agentId]
    );

    // Insert customer
    const hashedPassword = customerData.password ? await bcrypt.hash(customerData.password, 10) : null;

    // Get uploaded file paths
    const attachments = {};
    for (let i = 1; i <= 5; i++) {
      if (req.files && req.files[`attachments_${i}`] && req.files[`attachments_${i}`][0]) {
        attachments[`attachments_${i}`] = req.files[`attachments_${i}`][0].filename;
      } else {
        attachments[`attachments_${i}`] = null;
      }
    }

    const [customerResult] = await pool.query(
      `INSERT INTO customer (
        name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
        tds_amount, itr_password, income_type, mobile_no, mail_id, filling_type,
        last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3,
        attachments_4, attachments_5, income_slab, comment_box, customer_type, agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerData.name, customerData.father_name, customerData.dob, customerData.pan_number, customerData.adhar_number, customerData.account_number, customerData.bank_name, customerData.ifsc_code,
        customerData.tds_amount, customerData.itr_password, customerData.income_type, customerData.mobile_no, customerData.mail_id, customerData.filling_type,
        customerData.last_ay_income, customerData.profile_photo, customerData.user_id, hashedPassword, attachments.attachments_1, attachments.attachments_2, attachments.attachments_3,
        attachments.attachments_4, attachments.attachments_5, customerData.income_slab, customerData.comment_box, customerData.customer_type, req.agentId
      ]
    );

    const customerId = customerResult.insertId;

    // Insert payment record
    const [payment] = await pool.query(
      'INSERT INTO payment (agent_id, customer_id, amount, paid, payment_method,asst_year) VALUES (?, ?, ?, TRUE, ?,?)',
      [req.agentId, customerId, amount, paymentMethod, customerData.asst_year_3yr]
    );

    const balanceBeforeTxn = currentBalance;
    const balanceAfterTxn = currentBalance - amount;

    const [txnResult] = await pool.query(
      `INSERT INTO wallet_transactions 
             (agent_id, performed_by, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.agentId, req.agentId, 'debit', amount, balanceBeforeTxn, balanceAfterTxn, 'itr_payment', payment.insertId, 'ITR Payment']
    );

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Customer added and payment processed successfully', customerId });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error adding customer with payment:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'PAN number already exists. Please use a unique PAN number.' });
    }
    res.status(500).json({ message: 'Failed to add customer and process payment' });
  }
});


// Get all customers for the agent
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*,
             CASE WHEN EXISTS (
               SELECT 1 FROM payment p
               WHERE p.customer_id = c.id AND p.agent_id = c.agent_id AND p.paid = 1
             ) THEN 1 ELSE 0 END AS paid
      FROM customer c
      WHERE c.agent_id = ?
    `, [req.agentId]);
    console.log('Fetched customers:', rows);
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
router.put('/:id', authenticateToken, upload.fields([
  { name: 'attachments_1', maxCount: 1 },
  { name: 'attachments_2', maxCount: 1 },
  { name: 'attachments_3', maxCount: 1 },
  { name: 'attachments_4', maxCount: 1 },
  { name: 'attachments_5', maxCount: 1 },
  { name: 'attachments_6', maxCount: 1 }
]), async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  // Handle file uploads
  const attachments = {};
  for (let i = 1; i <= 6; i++) {
    if (req.files && req.files[`attachments_${i}`] && req.files[`attachments_${i}`][0]) {
      attachments[`attachments_${i}`] = req.files[`attachments_${i}`][0].filename;
    }
  }

  // Merge file paths into updates
  Object.assign(updates, attachments);

  // Remove 'paid' field as it's not part of the customer table
  delete updates.paid;

  // Handle password hashing
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

// Send selected customers to subadmin with assessment year
router.post('/send-to-subadmin', authenticateToken, async (req, res) => {
  const { customersWithYears, subadmin_id, formData } = req.body;

  if (!customersWithYears || !Array.isArray(customersWithYears) || customersWithYears.length === 0) {
    return res.status(400).json({ message: 'Customers with years are required' });
  }

  try {
    const customerIds = customersWithYears.map(item => item.customerId);

    // Verify that all customers belong to the agent and get their details
    const placeholders = customerIds.map(() => '?').join(',');
    const [customers] = await pool.query(
      `SELECT * FROM customer WHERE id IN (${placeholders}) AND agent_id = ?`,
      [...customerIds, req.agentId]
    );

    if (customers.length !== customerIds.length) {
      return res.status(400).json({ message: 'Some customers not found or do not belong to you' });
    }

    // Create a map for easy customer lookup
    const customerMap = customers.reduce((acc, c) => ({ ...acc, [c.id]: c }), {});

    const newEntries = [];
    const alreadySent = [];
    const unpaidCustomers = [];

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

      // Check payment status
      const [paymentRows] = await pool.query(
        'SELECT paid FROM payment WHERE customer_id = ? AND agent_id = ?',
        [customerId, req.agentId]
      );

      const hasPaid = paymentRows.length > 0 && paymentRows[0].paid;

      if (!hasPaid) {
        unpaidCustomers.push({ customerId, asstYear });
      } else {
        newEntries.push({ customerId, asstYear });
      }
    }

    if (unpaidCustomers.length > 0) {
      return res.status(400).json({
        message: 'Payment required for some customers before sending to subadmin',
        unpaidCustomers
      });
    }

    if (newEntries.length === 0) {
      return res.status(400).json({ message: 'All selected customers have already been sent for their respective assessment years' });
    }

    await pool.query('START TRANSACTION');

    for (const entry of newEntries) {
      const { customerId, asstYear } = entry;
      const customer = customerMap[customerId];

      // Insert new record into itr table
      const [itrResult] = await pool.query(
        `INSERT INTO itr (customer_id, asst_year, agent_id, agentedit, status, subadmin_send) VALUES (?, ?, ?, ?, ?, ?)`,
        [customerId, asstYear, req.agentId, false, 'Pending', 1]
      );

      const itrId = itrResult.insertId;

      // Snapshot values, overriding with formData if available
      const incomeSlab = formData?.income_slab || customer.income_slab;
      const fileCharge = formData?.file_charge || customer.file_charge;

      // Insert record into itr_customer table (snapshot)
      await pool.query(
        `INSERT INTO itr_customer (
          itr_id, name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
          tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type,
          last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3,
          attachments_4, attachments_5, attachments_6, file_charge, income_slab, comment_box, customer_type, agent_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itrId, customer.name, customer.father_name, customer.dob, customer.pan_number, customer.adhar_number, customer.account_number, customer.bank_name, customer.ifsc_code,
          customer.tds_amount, customer.itr_password, customer.asst_year_3yr, customer.income_type, customer.mobile_no, customer.mail_id, customer.filling_type,
          customer.last_ay_income, customer.profile_photo, customer.user_id, customer.password, customer.attachments_1, customer.attachments_2, customer.attachments_3,
          customer.attachments_4, customer.attachments_5, customer.attachments_6, fileCharge, incomeSlab, customer.comment_box, customer.customer_type, customer.agent_id
        ]
      );

      // Insert into subadmin_itr table for sent customers
      if (subadmin_id) {
        await pool.query(
          `INSERT INTO subadmin_itr (customer_id, subadmin_id, itr_id) VALUES (?, ?, ?)`,
          [customerId, subadmin_id, itrId]
        );
      }
    }

    await pool.query('COMMIT');

    res.json({
      message: `${newEntries.length} customer(s) sent to subadmin successfully`,
      sentCount: newEntries.length,
      alreadySentCount: alreadySent.length
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error sending customers to subadmin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get customers sent to subadmin (for subadmin view)
router.get('/sent-to-subadmin', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, i.created_at as sent_at, a.name as agent_name
      FROM subadmin_itr si
      JOIN itr i ON si.itr_id = i.id
      JOIN customer c ON i.customer_id = c.id
      JOIN agent a ON i.agent_id = a.id
      ORDER BY i.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sent customers:', error);
    res.status(500).json({ message: 'Failed to fetch sent customers' });
  }
});

// Check if PAN number already exists
router.get('/check-pan/:pan_number', authenticateToken, async (req, res) => {
  const { pan_number } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id FROM customer WHERE pan_number = ? AND agent_id = ?',
      [pan_number, req.agentId]
    );
    res.json({ exists: rows.length > 0 });
  } catch (error) {
    console.error('Error checking PAN:', error);
    res.status(500).json({ message: 'Failed to check PAN number' });
  }
});

// Get ITR customer snapshot
router.get('/snapshot/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM itr_customer WHERE itr_id = ? AND agent_id = ?',
      [itrId, req.agentId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Snapshot not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    res.status(500).json({ message: 'Failed to fetch snapshot' });
  }
});

// Update ITR customer snapshot (only if agentedit is allowed)
router.put('/snapshot/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;
  const updates = req.body;

  try {
    // Check if agentedit is allowed for this ITR
    const [itrRows] = await pool.query(
      'SELECT agentedit FROM itr WHERE id = ? AND agent_id = ?',
      [itrId, req.agentId]
    );

    if (itrRows.length === 0) {
      return res.status(404).json({ message: 'ITR not found' });
    }

    if (!itrRows[0].agentedit) {
      return res.status(403).json({ message: 'Edit not allowed for this ITR. Please request permission from subadmin/superadmin.' });
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Filter out restricted fields from snapshot updates
    const restrictedFields = ['id', 'itr_id', 'agent_id', 'snapshot_date', 'created_at'];
    const filteredFields = fields.filter(f => !restrictedFields.includes(f));
    const filteredValues = filteredFields.map(f => updates[f]);

    const setClause = filteredFields.map(field => `${field} = ?`).join(', ');

    await pool.query('START TRANSACTION');

    const [result] = await pool.query(
      `UPDATE itr_customer SET ${setClause} WHERE itr_id = ? AND agent_id = ?`,
      [...filteredValues, itrId, req.agentId]
    );

    // Reset agentedit to 0 after update
    await pool.query(
      'UPDATE itr SET agentedit = 0 WHERE id = ? AND agent_id = ?',
      [itrId, req.agentId]
    );

    await pool.query('COMMIT');

    res.json({ message: 'ITR snapshot updated successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating snapshot:', error);
    res.status(500).json({ message: 'Failed to update snapshot' });
  }
});

export default router;
