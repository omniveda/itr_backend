import express from 'express';
import { pool } from '../db.js';
const router = express.Router();
// Get all ITRs assigned to a CA
router.get('/assigned-itrs/:caId', async (req, res) => {
  const { caId } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT ca_itr.customer_id, ca_itr.agent_id, ca_itr.subadmin_id,
        c.name AS customer_name, c.pan_number, c.mobile_no AS customer_mobile, c.mail_id AS customer_email, c.dob,
        a.name AS agent_name, a.mobile_no AS agent_mobile
      FROM ca_itr
      JOIN customer c ON ca_itr.customer_id = c.id
      JOIN agent a ON ca_itr.agent_id = a.id
      WHERE ca_itr.ca_id = ?
      ORDER BY ca_itr.date DESC
    `, [caId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching assigned ITRs for CA:', error);
    res.status(500).json({ message: 'Failed to fetch assigned ITRs' });
  }
});


// Get all CAs
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, mobile_no, isca FROM ca WHERE isca = TRUE');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching CAs:', error);
    res.status(500).json({ message: 'Failed to fetch CAs' });
  }
});

// Assign CA to a customer
router.post('/assign', async (req, res) => {
  const { customer_id, subadmin_id, agent_id, ca_id } = req.body;
  if (!customer_id || !subadmin_id || !agent_id || !ca_id) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    // Check if already assigned
    const [existing] = await pool.query('SELECT * FROM ca_itr WHERE customer_id = ?', [customer_id]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'CA already assigned for this customer' });
    }
    await pool.query(
      'INSERT INTO ca_itr (customer_id, subadmin_id, agent_id, ca_id) VALUES (?, ?, ?, ?)',
      [customer_id, subadmin_id, agent_id, ca_id]
    );
    res.json({ message: 'CA assigned successfully' });
  } catch (error) {
    console.error('Error assigning CA:', error);
    res.status(500).json({ message: 'Failed to assign CA' });
  }
});

// Get assigned CA for a customer
router.get('/assigned/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT ca.id, ca.name, ca.email, ca.mobile_no FROM ca_itr
       JOIN ca ON ca_itr.ca_id = ca.id
       WHERE ca_itr.customer_id = ?`,
      [customer_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No CA assigned for this customer' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching assigned CA:', error);
    res.status(500).json({ message: 'Failed to fetch assigned CA' });
  }
});

export default router;
