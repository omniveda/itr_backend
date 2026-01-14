import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();

// Middleware to check if user is agent
const requireAgent = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isagent || decoded.isagent !== 'verified') {
      return res.status(403).json({ error: 'Access denied. Agent privileges required.' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM agent');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Database query error' });
  }
});

// // Get agent permissions
router.get('/permissions', requireAgent, async (req, res) => {
  try {
    console.log("permissions agents");
    const agentId = req.user.id;
    console.log("This is from agent permissions", agentId);
    const [permissions] = await pool.query('SELECT permissions FROM agent_permissions WHERE agent_id = ?', [agentId]);
    res.json(permissions.length > 0 ? JSON.parse(permissions[0].permissions) : []);
  } catch (error) {
    console.error('Error fetching agent permissions:', error);
    res.status(500).json({ error: 'Failed to fetch agent permissions' });
  }
});


router.get("/pan-number/:id", requireAgent, async (req, res) => {
  const agentId = req.params;
  try {
    const [customer] = await pool.query('SELECT pan_number FROM customer WHERE agent_id = ?', [agentId]);
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer pan number:', error);
    res.status(500).json({ error: 'Failed to fetch customer pan number' });
  }
});

// Update agent's own profile
router.put('/profile', requireAgent, async (req, res) => {
  const { id } = req.user; // From requireAgent middleware
  const { name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no } = req.body;

  if (!name || !mobile_no || !mail_id) {
    return res.status(400).json({ error: 'Name, mobile number, and email are required' });
  }

  try {
    await pool.query(
      'UPDATE agent SET name = ?, father_name = ?, mobile_no = ?, mail_id = ?, address = ?, profile_photo = ?, alternate_mobile_no = ? WHERE id = ?',
      [name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, id]
    );
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating agent profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});


export default router;
