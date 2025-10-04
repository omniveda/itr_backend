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
    const [rows] = await pool.query('SELECT * FROM itr WHERE agent_id = ?', [req.agentId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ITR entries:', error);
    res.status(500).json({ message: 'Failed to fetch ITR entries' });
  }
});

// Create new ITR entry
router.post('/', authenticateToken, async (req, res) => {
  const {
    name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
    tds_details, itr_password, asst_year, income_salary_business, mobile_no_adhar_registered,
    mail_id, income_slab, comment_box, attachment_1, attachment_2, attachment_3, attachment_4, attachment_5,
    customer_id, agentedit
  } = req.body;

  if (!name || !pan_number || !customer_id) {
    return res.status(400).json({ message: 'Name, PAN number, and customer_id are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO itr (
        name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
        tds_details, itr_password, asst_year, income_salary_business, mobile_no_adhar_registered,
        mail_id, income_slab, comment_box, attachment_1, attachment_2, attachment_3, attachment_4, attachment_5,
        agent_id, customer_id, agentedit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code,
        tds_details, itr_password, asst_year, income_salary_business, mobile_no_adhar_registered,
        mail_id, income_slab, comment_box, attachment_1, attachment_2, attachment_3, attachment_4, attachment_5,
        req.agentId, customer_id, agentedit || false
      ]
    );
    res.status(201).json({ message: 'ITR added successfully', itrId: result.insertId });
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

export default router;
