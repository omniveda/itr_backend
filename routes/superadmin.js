import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../db.js';

const router = express.Router();

// Middleware to check if user is superadmin
const requireSuperadmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.issuperadmin) {
      return res.status(403).json({ error: 'Access denied. Superadmin privileges required.' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all agents
router.get('/agents', requireSuperadmin, async (req, res) => {
  try {
    const [agents] = await pool.query('SELECT id, name, mobile_no, mail_id, isagent, wbalance FROM agent');
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Toggle agent verification status
router.put('/agents/:id/verify', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get current status
    const [rows] = await pool.query('SELECT isagent FROM agent WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const currentStatus = rows[0].isagent;
    const newStatus = currentStatus === 'verified' ? 'unverified' : 'verified';

    await pool.query('UPDATE agent SET isagent = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `Agent ${newStatus} successfully` });
  } catch (error) {
    console.error('Error updating agent verification:', error);
    res.status(500).json({ error: 'Failed to update agent verification' });
  }
});

// Adjust agent wallet balance
router.put('/agents/:id/wallet', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body; // amount can be positive (add) or negative (subtract)
  if (typeof amount !== 'number') {
    return res.status(400).json({ error: 'Amount must be a number' });
  }
  try {
    await pool.query('UPDATE agent SET wbalance = wbalance + ? WHERE id = ?', [amount, id]);
    res.json({ message: 'Wallet balance updated successfully' });
  } catch (error) {
    console.error('Error updating wallet balance:', error);
    res.status(500).json({ error: 'Failed to update wallet balance' });
  }
});

// Get all subadmins with their permissions
router.get('/subadmins', requireSuperadmin, async (req, res) => {
  try {
    const [subadmins] = await pool.query(`
      SELECT s.id, s.username,
             GROUP_CONCAT(sp.permission SEPARATOR ',') as permissions
      FROM subadmin s
      LEFT JOIN subadmin_permissions sp ON s.id = sp.subadmin_id
      GROUP BY s.id, s.username
    `);
    // Parse permissions string into array
    const result = subadmins.map(subadmin => ({
      ...subadmin,
      permissions: subadmin.permissions ? subadmin.permissions.split(',') : []
    }));
    res.json(result);
  } catch (error) {
    console.error('Error fetching subadmins:', error);
    res.status(500).json({ error: 'Failed to fetch subadmins' });
  }
});

// Create a new subadmin
router.post('/subadmins', requireSuperadmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO subadmin (username, password, issubadmin) VALUES (?, ?, TRUE)', [username, hashedPassword]);
    res.status(201).json({ message: 'Subadmin created successfully' });
  } catch (error) {
    console.error('Error creating subadmin:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create subadmin' });
    }
  }
});

// Update subadmin credentials
router.put('/subadmins/:id', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  try {
    let query = 'UPDATE subadmin SET username = ?';
    let params = [username];
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }
    query += ' WHERE id = ?';
    params.push(id);

    const [result] = await pool.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Subadmin not found' });
    }
    res.json({ message: 'Subadmin updated successfully' });
  } catch (error) {
    console.error('Error updating subadmin:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update subadmin' });
    }
  }
});

// Delete a subadmin
router.delete('/subadmins/:id', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM subadmin WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Subadmin not found' });
    }
    res.json({ message: 'Subadmin deleted successfully' });
  } catch (error) {
    console.error('Error deleting subadmin:', error);
    res.status(500).json({ error: 'Failed to delete subadmin' });
  }
});

// Get subadmin permissions
router.get('/subadmins/:id/permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [permissions] = await pool.query('SELECT permission FROM subadmin_permissions WHERE subadmin_id = ?', [id]);
    res.json(permissions.map(p => p.permission));
  } catch (error) {
    console.error('Error fetching subadmin permissions:', error);
    res.status(500).json({ error: 'Failed to fetch subadmin permissions' });
  }
});

// Update subadmin permissions
router.put('/subadmins/:id/permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body; // array of permission strings
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions must be an array' });
  }
  try {
    // Delete existing permissions
    await pool.query('DELETE FROM subadmin_permissions WHERE subadmin_id = ?', [id]);
    // Insert new permissions
    if (permissions.length > 0) {
      const values = permissions.map(permission => [id, permission]);
      await pool.query('INSERT INTO subadmin_permissions (subadmin_id, permission) VALUES ?', [values]);
    }
    res.json({ message: 'Subadmin permissions updated successfully' });
  } catch (error) {
    console.error('Error updating subadmin permissions:', error);
    res.status(500).json({ error: 'Failed to update subadmin permissions' });
  }
});

// Get all CAs
router.get('/cas', requireSuperadmin, async (req, res) => {
  try {
    const [cas] = await pool.query('SELECT id, name, username, email, isca FROM ca');
    res.json(cas);
  } catch (error) {
    console.error('Error fetching CAs:', error);
    res.status(500).json({ error: 'Failed to fetch CAs' });
  }
});

// Create a new CA
router.post('/cas', requireSuperadmin, async (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Name, username, email, and password are required' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO ca (name, username, email, password) VALUES (?, ?, ?, ?)', [name, username, email, hashedPassword]);
    res.status(201).json({ message: 'CA created successfully' });
  } catch (error) {
    console.error('Error creating CA:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create CA' });
    }
  }
});

// Update CA details
router.put('/cas/:id', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { name, username, email, password } = req.body;
  if (!name || !username || !email) {
    return res.status(400).json({ error: 'Name, username, and email are required' });
  }
  try {
    let query = 'UPDATE ca SET name = ?, username = ?, email = ?';
    let params = [name, username, email];
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }
    query += ' WHERE id = ?';
    params.push(id);

    const [result] = await pool.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'CA not found' });
    }
    res.json({ message: 'CA updated successfully' });
  } catch (error) {
    console.error('Error updating CA:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update CA' });
    }
  }
});

// Delete a CA
router.delete('/cas/:id', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM ca WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'CA not found' });
    }
    res.json({ message: 'CA deleted successfully' });
  } catch (error) {
    console.error('Error deleting CA:', error);
    res.status(500).json({ error: 'Failed to delete CA' });
  }
});

// Toggle CA status (using isca field as status indicator)
router.put('/cas/:id/status', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get current status
    const [rows] = await pool.query('SELECT isca FROM ca WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'CA not found' });
    }
    const currentStatus = rows[0].isca;
    const newStatus = currentStatus ? false : true;

    await pool.query('UPDATE ca SET isca = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `CA ${newStatus ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Error updating CA status:', error);
    res.status(500).json({ error: 'Failed to update CA status' });
  }
});

// Get all customers
router.get('/customers', requireSuperadmin, async (req, res) => {
  try {
    const [customers] = await pool.query('SELECT * FROM customer');
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get all payments
router.get('/payments', requireSuperadmin, async (req, res) => {
  try {
    const [payments] = await pool.query('SELECT id, amount, paid, payment_method, created_at FROM payment');
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get dashboard statistics
router.get('/dashboard-stats', requireSuperadmin, async (req, res) => {
  try {
    const [agentCount] = await pool.query('SELECT COUNT(*) as count FROM agent');
    const [subadminCount] = await pool.query('SELECT COUNT(*) as count FROM subadmin');
    const [caCount] = await pool.query('SELECT COUNT(*) as count FROM ca');
    const [customerCount] = await pool.query('SELECT COUNT(*) as count FROM customer');
    const [paymentStats] = await pool.query('SELECT SUM(amount) as totalRevenue FROM payment WHERE paid = TRUE');

    res.json({
      agents: agentCount[0].count,
      subadmins: subadminCount[0].count,
      cas: caCount[0].count,
      customers: customerCount[0].count,
      totalRevenue: paymentStats[0].totalRevenue || 0
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

export default router;
