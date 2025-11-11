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
    req.subadminId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// GET /api/subadmin/sent-customers
// Returns all customers sent by agents (joined from subadmin_itr, customer, agent)
router.get('/sent-customers', authenticateToken, async (req, res) => {
  try {
    console.log('Decoded subadminId from JWT:', req.subadminId);
    const [rows] = await pool.query(`
      SELECT s.id, s.customer_id, s.agent_id, s.sent_at,
        c.name AS customer_name, c.pan_number, c.mobile_no AS customer_mobile, c.mail_id AS customer_email, c.dob,
             a.name AS agent_name, a.mobile_no AS agent_mobile
      FROM subadmin_itr s
      JOIN customer c ON s.customer_id = c.id
      JOIN agent a ON s.agent_id = a.id
      ORDER BY s.sent_at DESC
    `);
    console.log('Rows returned from subadmin_itr join:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sent customers:', error);
    res.status(500).json({ message: 'Failed to fetch sent customers' });
  }
});

// GET /api/subadmin/permissions
// Returns permissions for the authenticated subadmin
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const [permissions] = await pool.query('SELECT permission FROM subadmin_permissions WHERE subadmin_id = ?', [req.subadminId]);
    res.json(permissions.map(p => p.permission));
  } catch (error) {
    console.error('Error fetching subadmin permissions:', error);
    res.status(500).json({ message: 'Failed to fetch permissions' });
  }
});

export default router;
