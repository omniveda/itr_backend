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
  { name: 'attachments_5', maxCount: 1 }
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
    for (let i = 1; i <= 5; i++) {
      if (req.files && req.files[`attachments_${i}`] && req.files[`attachments_${i}`][0]) {
        attachments[`attachments_${i}`] = req.files[`attachments_${i}`][0].filename;
      } else {
        attachments[`attachments_${i}`] = null;
      }
    }

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
        last_ay_income, profile_photo, user_id, hashedPassword, attachments.attachments_1, attachments.attachments_2, attachments.attachments_3,
        attachments.attachments_4, attachments.attachments_5, file_charge, income_slab, comment_box, customer_type, req.agentId
      ]
    );
    res.status(201).json({ message: 'Customer added successfully', customerId: result.insertId });
  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({ message: 'Failed to add customer' });
  }
});

// Create customer with wallet payment and file uploads
router.post('/with-payment', authenticateToken, upload.fields([
  { name: 'attachments_1', maxCount: 1 },
  { name: 'attachments_2', maxCount: 1 },
  { name: 'attachments_3', maxCount: 1 },
  { name: 'attachments_4', maxCount: 1 },
  { name: 'attachments_5', maxCount: 1 }
]), async (req, res) => {
  const { paymentMethod, ...customerData } = req.body;

  if (paymentMethod !== 'wallet') {
    return res.status(400).json({ message: 'This endpoint only supports wallet payment' });
  }

  const amount = parseFloat(customerData.file_charge || 0);
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Valid file charge is required' });
  }

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
        tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type,
        last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3,
        attachments_4, attachments_5, file_charge, income_slab, comment_box, customer_type, agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerData.name, customerData.father_name, customerData.dob, customerData.pan_number, customerData.adhar_number, customerData.account_number, customerData.bank_name, customerData.ifsc_code,
        customerData.tds_amount, customerData.itr_password, customerData.asst_year_3yr, customerData.income_type, customerData.mobile_no, customerData.mail_id, customerData.filling_type,
        customerData.last_ay_income, customerData.profile_photo, customerData.user_id, hashedPassword, attachments.attachments_1, attachments.attachments_2, attachments.attachments_3,
        attachments.attachments_4, attachments.attachments_5, customerData.file_charge, customerData.income_slab, customerData.comment_box, customerData.customer_type, req.agentId
      ]
    );

    const customerId = customerResult.insertId;

    // Insert payment record
    await pool.query(
      'INSERT INTO payment (agent_id, customer_id, amount, paid, payment_method) VALUES (?, ?, ?, TRUE, ?)',
      [req.agentId, customerId, amount, paymentMethod]
    );

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Customer added and payment processed successfully', customerId });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error adding customer with payment:', error);
    res.status(500).json({ message: 'Failed to add customer and process payment' });
  }
});


// Get all customers for the agent
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, CASE WHEN p.paid = 1 THEN 1 ELSE 0 END AS paid
      FROM customer c
      LEFT JOIN payment p ON c.id = p.customer_id AND c.agent_id = p.agent_id
      WHERE c.agent_id = ?
    `, [req.agentId]);
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
  { name: 'attachments_5', maxCount: 1 }
]), async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  // Handle file uploads
  const attachments = {};
  for (let i = 1; i <= 5; i++) {
    if (req.files && req.files[`attachments_${i}`] && req.files[`attachments_${i}`][0]) {
      attachments[`attachments_${i}`] = req.files[`attachments_${i}`][0].filename;
    }
  }

  // Merge file paths into updates
  Object.assign(updates, attachments);

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
  const { customersWithYears } = req.body;

  if (!customersWithYears || !Array.isArray(customersWithYears) || customersWithYears.length === 0) {
    return res.status(400).json({ message: 'Customers with years are required' });
  }

  try {
    const customerIds = customersWithYears.map(item => item.customerId);
    const asstYears = customersWithYears.map(item => item.asstYear);

    // Verify that all customers belong to the agent
    const placeholders = customerIds.map(() => '?').join(',');
    const [customers] = await pool.query(
      `SELECT id, name, pan_number FROM customer WHERE id IN (${placeholders}) AND agent_id = ?`,
      [...customerIds, req.agentId]
    );

    if (customers.length !== customerIds.length) {
      return res.status(400).json({ message: 'Some customers not found or do not belong to you' });
    }

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

    // Insert new records into itr table
    const values = newEntries.map(entry => [
      entry.customerId,
      entry.asstYear,
      req.agentId,
      false, // agentedit
      'Pending' // status
    ]);
    const placeholdersInsert = values.map(() => '(?, ?, ?, ?, ?)').join(',');
    const flatValues = values.flat();

    await pool.query(
      `INSERT INTO itr (customer_id, asst_year, agent_id, agentedit, status) VALUES ${placeholdersInsert}`,
      flatValues
    );

    // Update subadmin_send to true for sent customers
    const newCustomerIds = newEntries.map(entry => entry.customerId);
    const updatePlaceholders = newCustomerIds.map(() => '?').join(',');
    await pool.query(
      `UPDATE customer SET subadmin_send = TRUE WHERE id IN (${updatePlaceholders}) AND agent_id = ?`,
      [...newCustomerIds, req.agentId]
    );

    res.json({
      message: `${newEntries.length} customer(s) sent to subadmin successfully`,
      sentCount: newEntries.length,
      alreadySentCount: alreadySent.length
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
