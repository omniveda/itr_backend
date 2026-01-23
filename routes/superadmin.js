import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads (using memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and document files are allowed!'));
    }
  }
});

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

// Get all agents with their permissions
router.get('/agents', requireSuperadmin, async (req, res) => {
  try {
    const [agents] = await pool.query(`
      SELECT a.id, a.name, a.father_name, a.mobile_no, a.mail_id, a.address, a.profile_photo, a.alternate_mobile_no, a.isagent, a.file_charge, a.wbalance, a.isdownload,
             ap.permissions
      FROM agent a
      LEFT JOIN agent_permissions ap ON a.id = ap.agent_id
    `);
    // Parse permissions JSON
    const result = agents.map(agent => ({
      ...agent,
      permissions: agent.permissions ? JSON.parse(agent.permissions) : []
    }));
    res.json(result);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

router.put('/agents/:id/file-charge', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { fileCharge } = req.body;
  try {
    const [rows] = await pool.query('SELECT id FROM agent WHERE id=?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    console.log(fileCharge);
    await pool.query('UPDATE agent SET file_charge=? WHERE id=?', [fileCharge, id]);
    res.json({ message: `Agent ${fileCharge} file charge successfully set` });
  } catch {
    res.status(500).json({ error: 'Failed to update agent' });
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

// Toggle agent download status
router.put('/agents/:id/download-status', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get current status
    const [rows] = await pool.query('SELECT isdownload FROM agent WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const currentStatus = rows[0].isdownload;
    const newStatus = currentStatus === 'verified' ? 'unverified' : 'verified';

    await pool.query('UPDATE agent SET isdownload = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `Agent download ${newStatus} successfully`, status: newStatus });
  } catch (error) {
    console.error('Error toggling agent download status:', error);
    res.status(500).json({ error: 'Failed to toggle download status' });
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

// Update agent details
router.put('/agents/:id', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no } = req.body;
  if (!name || !mobile_no || !mail_id) {
    return res.status(400).json({ error: 'Name, mobile number, and email are required' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE agent SET name = ?, father_name = ?, mobile_no = ?, mail_id = ?, address = ?, profile_photo = ?, alternate_mobile_no = ? WHERE id = ?',
      [name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ message: 'Agent updated successfully' });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Get all subadmins with their permissions
router.get('/subadmins', requireSuperadmin, async (req, res) => {
  try {
    const [subadmins] = await pool.query(`
      SELECT s.id, s.username, s.issubadmin, s.reject, s.isdownload,
             GROUP_CONCAT(sp.permission SEPARATOR ',') as permissions
      FROM subadmin s
      LEFT JOIN subadmin_permissions sp ON s.id = sp.subadmin_id
      GROUP BY s.id, s.username, s.issubadmin, s.reject, s.isdownload
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

// Toggle subadmin reject permission
router.put('/subadmins/:id/reject-permission', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get current status
    const [rows] = await pool.query('SELECT reject FROM subadmin WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Subadmin not found' });
    }
    const currentStatus = rows[0].reject;
    const newStatus = !currentStatus; // Toggle boolean

    await pool.query('UPDATE subadmin SET reject = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `Subadmin reject permission ${newStatus ? 'enabled' : 'disabled'} successfully`, reject: newStatus });
  } catch (error) {
    console.error('Error toggling subadmin reject permission:', error);
    res.status(500).json({ error: 'Failed to toggle reject permission' });
  }
});

// Toggle ca reject permission
router.put('/cas/:id/reject-permission', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get current status
    const [rows] = await pool.query('SELECT reject FROM ca WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'CA not found' });
    }
    const currentStatus = rows[0].reject;
    const newStatus = !currentStatus; // Toggle boolean

    await pool.query('UPDATE ca SET reject = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `CA reject permission ${newStatus ? 'enabled' : 'disabled'} successfully`, reject: newStatus });
  } catch (error) {
    console.error('Error toggling CA reject permission:', error);
    res.status(500).json({ error: 'Failed to toggle reject permission' });
  }
});

// Toggle ca history permission
router.put('/cas/:id/history-permission', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get current status
    const [rows] = await pool.query('SELECT history FROM ca WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'CA not found' });
    }
    const currentStatus = rows[0].history;
    const newStatus = !currentStatus; // Toggle boolean

    await pool.query('UPDATE ca SET history = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `CA history permission ${newStatus ? 'enabled' : 'disabled'} successfully`, history: newStatus });
  } catch (error) {
    console.error('Error toggling CA history permission:', error);
    res.status(500).json({ error: 'Failed to toggle history permission' });
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

    // Handle subadmin_customer_permission table for manage_agents permission (customer fields)
    console.log("permissions", permissions.includes('manage_itr'));
    const hasManageAgents = permissions.includes('manage_itr');
    if (hasManageAgents) {
      // Get the permission id for manage_agents
      const [permRows] = await pool.query('SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?', [id, 'manage_itr']);
      if (permRows.length > 0) {
        const permId = permRows[0].id;
        // Check if record already exists
        const [existing] = await pool.query('SELECT id FROM Subadmin_customer_permission WHERE subadmin_permissions_id = ?', [permId]);
        if (existing.length === 0) {
          // Insert new record with all fields set to 0
          await pool.query('INSERT INTO Subadmin_customer_permission (subadmin_permissions_id, name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)', [permId]);
        }
      }
    } else {
      // Delete any existing record for manage_agents
      await pool.query('DELETE FROM subadmin_customer_permission WHERE subadmin_permissions_id IN (SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?)', [id, 'manage_agents']);
    }

    // Handle subadmin_permission_agent table for manage_itr permission (agent fields)
    const hasManageITR = permissions.includes('manage_agents');
    if (hasManageITR) {
      // Get the permission id for manage_itr
      const [permRows] = await pool.query('SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?', [id, 'manage_agents']);
      if (permRows.length > 0) {
        const permId = permRows[0].id;
        // Check if record already exists
        const [existing] = await pool.query('SELECT id FROM subadmin_permission_agent WHERE subadmin_permissions_id = ?', [permId]);
        if (existing.length === 0) {
          // Insert new record with all fields set to 0
          await pool.query('INSERT INTO subadmin_permission_agent (subadmin_permissions_id, name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, password, wbalance) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0)', [permId]);
        }
      }
    } else {
      // Delete any existing record for manage_itr
      await pool.query('DELETE FROM subadmin_permission_agent WHERE subadmin_permissions_id IN (SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?)', [id, 'manage_itr']);
    }

    res.json({ message: 'Subadmin permissions updated successfully' });
  } catch (error) {
    console.error('Error updating subadmin permissions:', error);
    res.status(500).json({ error: 'Failed to update subadmin permissions' });
  }
});

// Get subadmin password (for viewing only)
router.get('/subadmins/:id/password', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT username, password FROM subadmin WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Subadmin not found' });
    }
    res.json({ username: rows[0].username, password: rows[0].password });
  } catch (error) {
    console.error('Error fetching subadmin password:', error);
    res.status(500).json({ error: 'Failed to fetch subadmin password' });
  }
});

// Get subadmin ITR flow permissions
router.get('/subadmins/:id/itr-permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM subadmin_itr_permissions WHERE subadmin_id = ?', [id]);
    if (rows.length === 0) {
      // Create default permissions if not exists
      const [subadmin] = await pool.query('SELECT username FROM subadmin WHERE id = ?', [id]);
      if (subadmin.length === 0) return res.status(404).json({ error: 'Subadmin not found' });

      await pool.query(
        'INSERT INTO subadmin_itr_permissions (subadmin_id, subadmin_name) VALUES (?, ?)',
        [id, subadmin[0].username]
      );
      const [newRows] = await pool.query('SELECT * FROM subadmin_itr_permissions WHERE subadmin_id = ?', [id]);
      return res.json(newRows[0]);
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching subadmin ITR permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Toggle a specific subadmin ITR flow permission
router.post('/subadmins/:id/itr-permissions/toggle', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { field } = req.body;
  const allowedFields = ['pending', 'in_progress', 'e_verification', 'completed', 'rejected', 'flow', 'ca_change', 'recharge_not', 'itr_history'];

  if (!allowedFields.includes(field)) {
    return res.status(400).json({ error: 'Invalid permission field' });
  }

  try {
    await pool.query(
      `UPDATE subadmin_itr_permissions SET ${field} = NOT ${field} WHERE subadmin_id = ?`,
      [id]
    );
    const [rows] = await pool.query('SELECT * FROM subadmin_itr_permissions WHERE subadmin_id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error toggling subadmin ITR permission:', error);
    res.status(500).json({ error: 'Failed to toggle permission' });
  }
});

// Duplicate a subadmin with same permissions
router.post('/subadmins/:id/duplicate', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    // Check if original subadmin exists
    const [original] = await pool.query('SELECT id FROM subadmin WHERE id = ?', [id]);
    if (original.length === 0) {
      return res.status(404).json({ error: 'Original subadmin not found' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new subadmin
    const [result] = await pool.query('INSERT INTO subadmin (username, password, issubadmin) VALUES (?, ?, TRUE)', [username, hashedPassword]);
    const newSubadminId = result.insertId;

    // Copy permissions from original subadmin
    const [permissions] = await pool.query('SELECT permission FROM subadmin_permissions WHERE subadmin_id = ?', [id]);
    if (permissions.length > 0) {
      const values = permissions.map(p => [newSubadminId, p.permission]);
      await pool.query('INSERT INTO subadmin_permissions (subadmin_id, permission) VALUES ?', [values]);
    }

    res.status(201).json({ message: 'Subadmin duplicated successfully' });
  } catch (error) {
    console.error('Error duplicating subadmin:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to duplicate subadmin' });
    }
  }
});

// Toggle subadmin status (issubadmin field)
router.put('/subadmins/:id/status', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get current status
    const [rows] = await pool.query('SELECT issubadmin FROM subadmin WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Subadmin not found' });
    }
    const currentStatus = rows[0].issubadmin;
    const newStatus = currentStatus ? false : true;

    await pool.query('UPDATE subadmin SET issubadmin = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `Subadmin ${newStatus ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Error updating subadmin status:', error);
    res.status(500).json({ error: 'Failed to update subadmin status' });
  }
});

// Get all CAs with their permissions
router.get('/cas', requireSuperadmin, async (req, res) => {
  try {
    const [cas] = await pool.query(`
      SELECT c.id, c.name, c.username, c.email, c.isca, c.reject, c.history,
             GROUP_CONCAT(cp.permission SEPARATOR ',') as permissions
      FROM ca c
      LEFT JOIN ca_permissions cp ON c.id = cp.ca_id
      GROUP BY c.id, c.name, c.username, c.email, c.isca, c.reject, c.history
    `);
    // Parse permissions string into array
    const result = cas.map(ca => ({
      ...ca,
      permissions: ca.permissions ? ca.permissions.split(',') : []
    }));
    res.json(result);
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

// Get CA permissions
router.get('/cas/:id/permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [permissions] = await pool.query('SELECT permission FROM ca_permissions WHERE ca_id = ?', [id]);
    res.json(permissions.map(p => p.permission));
  } catch (error) {
    console.error('Error fetching CA permissions:', error);
    res.status(500).json({ error: 'Failed to fetch CA permissions' });
  }
});

// Update CA permissions
router.put('/cas/:id/permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body; // array of permission strings
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions must be an array' });
  }
  try {
    // Delete existing permissions
    await pool.query('DELETE FROM ca_permissions WHERE ca_id = ?', [id]);
    // Insert new permissions
    if (permissions.length > 0) {
      const values = permissions.map(permission => [id, permission]);
      await pool.query('INSERT INTO ca_permissions (ca_id, permission) VALUES ?', [values]);
    }

    // Handle ca_customer_permission table for manage_itr permission
    if (permissions.includes('manage_itr')) {
      // Get the permission id for manage_itr
      const [permRows] = await pool.query('SELECT id FROM ca_permissions WHERE ca_id = ? AND permission = ?', [id, 'manage_itr']);
      if (permRows.length > 0) {
        const permId = permRows[0].id;
        // Check if record already exists
        const [existing] = await pool.query('SELECT id FROM ca_customer_permission WHERE ca_permissions_id = ?', [permId]);
        if (existing.length === 0) {
          // Insert new record with all fields set to 0
          await pool.query('INSERT INTO ca_customer_permission (ca_permissions_id, name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)', [permId]);
        }
      }
    } else {
      // Delete any existing record for manage_itr
      await pool.query('DELETE FROM ca_customer_permission WHERE ca_permissions_id IN (SELECT id FROM ca_permissions WHERE ca_id = ? AND permission = ?)', [id, 'manage_itr']);
    }

    res.json({ message: 'CA permissions updated successfully' });
  } catch (error) {
    console.error('Error updating CA permissions:', error);
    res.status(500).json({ error: 'Failed to update CA permissions' });
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

// Get all customers with assignment status
router.get('/customers', requireSuperadmin, async (req, res) => {
  try {
    const { caId } = req.query;
    let query = `
      SELECT c.*, MAX(si.subadmin_id) as assignedSubadminId
      FROM customer c
      LEFT JOIN itr i ON c.id = i.customer_id
      LEFT JOIN subadmin_itr si ON i.id = si.itr_id
      GROUP BY c.id
    `;
    let params = [];

    if (caId) {
      query = `
        SELECT c.*, MAX(si.subadmin_id) as assignedSubadminId, MAX(ci.ca_id) as assignedCAId
        FROM customer c
        LEFT JOIN itr i ON c.id = i.customer_id
        LEFT JOIN subadmin_itr si ON i.id = si.itr_id
        LEFT JOIN ca_itr ci ON i.id = ci.itr_id AND ci.ca_id = ?
        GROUP BY c.id
      `;
      params.push(caId);
    }

    const [customers] = await pool.query(query, params);

    // If caId is provided, the query already has assignedCAId
    if (caId) {
      res.json(customers);
    } else {
      res.json(customers);
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get all payments
router.get('/payments', requireSuperadmin, async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT p.*, 
             c.name as customer_name, c.pan_number as customer_pan, c.mobile_no as customer_mobile,
             a.name as agent_name
      FROM payment p
      JOIN customer c ON p.customer_id = c.id
      JOIN agent a ON p.agent_id = a.id
      ORDER BY p.created_at DESC
    `);
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
    const [itrpendingCount] = await pool.query('SELECT COUNT(*) as count FROM itr where status = "Pending"');
    const [itrcompletedCount] = await pool.query('SELECT COUNT(*) as count FROM itr where status = "Completed"');

    res.json({
      agents: agentCount[0].count,
      subadmins: subadminCount[0].count,
      cas: caCount[0].count,
      customers: customerCount[0].count,
      totalRevenue: paymentStats[0].totalRevenue || 0,
      itrpending: itrpendingCount[0].count,
      itrcompleted: itrcompletedCount[0].count
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get all customer form fields
router.get('/customer-form-fields', requireSuperadmin, async (req, res) => {
  try {
    const [fields] = await pool.query('SELECT * FROM customer_form_fields ORDER BY display_order');
    res.json(fields);
  } catch (error) {
    console.error('Error fetching customer form fields:', error);
    res.status(500).json({ error: 'Failed to fetch customer form fields' });
  }
});

// Get customer form fields for agents (public endpoint)
router.get('/customer-form-fields/public', async (req, res) => {
  try {
    const [fields] = await pool.query('SELECT * FROM customer_form_fields WHERE is_required = TRUE OR is_recommended = TRUE ORDER BY display_order');
    res.json(fields);
  } catch (error) {
    console.error('Error fetching customer form fields:', error);
    res.status(500).json({ error: 'Failed to fetch customer form fields' });
  }
});

// Update customer form field settings
router.put('/customer-form-fields/:id', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { is_required, is_recommended } = req.body;

  if ((typeof is_required !== 'boolean' && typeof is_required !== 'number') || (typeof is_recommended !== 'boolean' && typeof is_recommended !== 'number')) {
    return res.status(400).json({ error: 'is_required and is_recommended must be boolean or number values' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE customer_form_fields SET is_required = ?, is_recommended = ? WHERE id = ?',
      [is_required, is_recommended, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }

    res.json({ message: 'Field settings updated successfully' });
  } catch (error) {
    console.error('Error updating customer form field:', error);
    res.status(500).json({ error: 'Failed to update customer form field' });
  }
});

// Get all ITRs
router.get('/itrs', requireSuperadmin, async (req, res) => {
  try {
    const [itrs] = await pool.query(`
      SELECT 
        itr.id, 
        ic.name as customer_name,
        ic.father_name,
        ic.pan_number,
        ic.dob,
        ic.adhar_number,
        ic.mobile_no,
        ic.account_number,
        ic.bank_name,
        ic.ifsc_code,
        ic.mail_id,
        ic.tds_amount,
        ic.itr_password,
        ic.income_type,
        ic.filling_type,
        ic.last_ay_income,
        ic.profile_photo,
        ic.attachments_1,
        ic.attachments_2,
        ic.attachments_3,
        ic.attachments_4,
        ic.attachments_5,
        ic.income_slab,
        ic.comment_box,
        ic.customer_type, 
        itr.status, 
        itr.agent_id, 
        itr.created_at, 
        itr.asst_year, 
        itr.Ca_doc1, 
        itr.Ca_doc2, 
        itr.Ca_doc3, 
        itr.subadmin_send, 
        itr.ca_send, 
        itr.ca_id, 
        itr.superadmin_send, 
        itr.Subadmin_doc1, 
        itr.Subadmin_doc2, 
        itr.otp_check, 
        itr.Superadmin_doc1, 
        itr.Comment, 
        itr.extra_charge
      FROM itr
      LEFT JOIN itr_customer ic ON itr.id = ic.itr_id
      ORDER BY itr.id DESC
    `);
    res.json(itrs);
  } catch (error) {
    console.error('Error fetching ITRs:', error);
    res.status(500).json({ error: 'Failed to fetch ITRs' });
  }
});

// Allot customers to subadmin
router.post('/subadmins/allot-customers', requireSuperadmin, async (req, res) => {
  const { subadminId, customerIds } = req.body;

  if (!subadminId || !Array.isArray(customerIds) || customerIds.length === 0) {
    return res.status(400).json({ error: 'subadminId and customerIds array are required' });
  }

  try {
    // Verify subadmin exists
    const [subadminRows] = await pool.query('SELECT id FROM subadmin WHERE id = ?', [subadminId]);
    if (subadminRows.length === 0) {
      return res.status(404).json({ error: 'Subadmin not found' });
    }

    // Verify all customers exist
    const [customerRows] = await pool.query('SELECT id FROM customer WHERE id IN (?)', [customerIds]);
    if (customerRows.length !== customerIds.length) {
      return res.status(404).json({ error: 'One or more customers not found' });
    }

    // Get all ITRs for these customers that are meant for subadmin
    const [itrs] = await pool.query('SELECT id FROM itr WHERE customer_id IN (?) AND subadmin_send = TRUE', [customerIds]);

    if (itrs.length > 0) {
      // Insert records into subadmin_itr table
      const values = itrs.map(itr => [itr.id, subadminId]);
      await pool.query('INSERT INTO subadmin_itr (itr_id, subadmin_id) VALUES ?', [values]);
    }

    // Update customer table to set subadmin_send = TRUE
    await pool.query('UPDATE customer SET subadmin_send = TRUE WHERE id IN (?)', [customerIds]);

    res.json({ message: 'Customers allotted to subadmin successfully' });
  } catch (error) {
    console.error('Error allotting customers to subadmin:', error);
    res.status(500).json({ error: 'Failed to allot customers to subadmin' });
  }
});

router.put('/otp-check/:itrId', requireSuperadmin, upload.single('document'), async (req, res) => {
  const { itrId } = req.params;
  try {
    console.log("Updating OTP check for ITR ID:", itrId);

    let updateQuery = 'UPDATE itr SET otp_check=TRUE, status="Completed"';
    let params = [];

    if (req.file) {
      const fileName = `superadmin_doc_${itrId}_${Date.now()}${path.extname(req.file.originalname)}`;
      const filePath = path.join(process.cwd(), 'uploads', fileName);

      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Write file to local system
      fs.writeFileSync(filePath, req.file.buffer);

      const fileUrl = `http://85.217.170.83/uploads/${fileName}`;
      updateQuery += ', Superadmin_doc1=?';
      params.push(fileUrl);
    }

    updateQuery += ' WHERE id=?';
    params.push(itrId);

    const [result] = await pool.query(updateQuery, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'ITR not found' });
    }

    // Update itr_flow with OTP/Completion date
    await pool.query(
      'UPDATE itr_flow SET everification_date = CURRENT_TIMESTAMP, completed_date = CURRENT_TIMESTAMP WHERE itr_id = ? AND completed_date IS NULL',
      [itrId]
    );

    res.json({ message: 'OTP check updated successfully' });
  } catch (error) {
    console.error('Error updating OTP check status:', error);
    return res.status(500).json({ error: 'Failed to update OTP check status' });
  }
});

// Undo rejection for an ITR
router.post('/undo-reject-itr/:itrId', requireSuperadmin, async (req, res) => {
  const { itrId } = req.params;
  try {
    // Check if the ITR is actually rejected
    const [itrRows] = await pool.query('SELECT status FROM itr WHERE id = ?', [itrId]);
    if (itrRows.length === 0) {
      return res.status(404).json({ error: 'ITR not found' });
    }
    if (itrRows[0].status !== 'Rejected') {
      return res.status(400).json({ error: 'Only rejected ITRs can be reverted' });
    }

    // Update status to Pending and clear comments/charges
    await pool.query(
      'UPDATE itr SET status = "Pending", Comment = NULL, extra_charge = NULL WHERE id = ?',
      [itrId]
    );

    res.json({ message: 'ITR rejection cancelled successfully and status reset to Pending.' });
  } catch (error) {
    console.error('Error undoing ITR rejection:', error);
    res.status(500).json({ error: 'Failed to cancel ITR rejection' });
  }
});


// Remove customer allotment from subadmin
router.delete('/subadmins/:subadminId/allot-customers/:customerId', requireSuperadmin, async (req, res) => {
  const { subadminId, customerId } = req.params;

  try {
    // Verify the allotment exists via its ITRs
    const [rows] = await pool.query('SELECT si.id FROM subadmin_itr si JOIN itr i ON si.itr_id = i.id WHERE i.customer_id = ? AND si.subadmin_id = ?', [customerId, subadminId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer allotment not found' });
    }

    // Delete the allotment record
    await pool.query('DELETE si FROM subadmin_itr si JOIN itr i ON si.itr_id = i.id WHERE i.customer_id = ? AND si.subadmin_id = ?', [customerId, subadminId]);

    // Update customer table to set subadmin_send = FALSE
    await pool.query('UPDATE customer SET subadmin_send = FALSE WHERE id = ?', [customerId]);

    res.json({ message: 'Customer allotment removed successfully' });
  } catch (error) {
    console.error('Error removing customer allotment:', error);
    res.status(500).json({ error: 'Failed to remove customer allotment' });
  }
});

// Allot customers to CA
router.post('/cas/allot-customers', requireSuperadmin, async (req, res) => {
  const { caId, customerIds } = req.body;

  if (!caId || !Array.isArray(customerIds) || customerIds.length === 0) {
    return res.status(400).json({ error: 'caId and customerIds array are required' });
  }

  try {
    // Verify CA exists
    const [caRows] = await pool.query('SELECT id FROM ca WHERE id = ?', [caId]);
    if (caRows.length === 0) {
      return res.status(404).json({ error: 'CA not found' });
    }

    // Verify all customers exist
    const [customerRows] = await pool.query('SELECT id FROM customer WHERE id IN (?)', [customerIds]);
    if (customerRows.length !== customerIds.length) {
      return res.status(404).json({ error: 'One or more customers not found' });
    }

    // Get the latest ITR for each customer that is marked to be sent to CA
    const [itrs] = await pool.query('SELECT id FROM itr WHERE customer_id IN (?) ORDER BY id DESC', [customerIds]);

    if (itrs.length === 0) {
      return res.status(404).json({ error: 'No ITRs found for these customers' });
    }

    // Insert records into ca_itr table
    const values = itrs.map(itr => [itr.id, caId]);
    await pool.query('INSERT INTO ca_itr (itr_id, ca_id) VALUES ?', [values]);

    res.json({ message: 'Customers/ITRs allotted to CA successfully' });
  } catch (error) {
    console.error('Error allotting customers to CA:', error);
    res.status(500).json({ error: 'Failed to allot customers to CA' });
  }
});

// Assign or Change CA for an ITR
router.put('/assign-ca/:itrId', requireSuperadmin, async (req, res) => {
  const { itrId } = req.params;
  const { caId } = req.body;

  if (!caId) {
    return res.status(400).json({ error: 'caId is required' });
  }

  try {
    // 1. Verify CA exists
    const [caRows] = await pool.query('SELECT id, name FROM ca WHERE id = ?', [caId]);
    if (caRows.length === 0) {
      return res.status(404).json({ error: 'CA not found' });
    }

    // 2. Update ITR table status and ca info
    await pool.query(
      'UPDATE itr SET ca_id = ?, ca_send = TRUE, status = "Filled" WHERE id = ?',
      [caId, itrId]
    );

    // 3. Insert or update ca_itr assignment
    await pool.query(`
      INSERT INTO ca_itr (itr_id, ca_id, status)
      VALUES (?, ?, 'Filled')
      ON DUPLICATE KEY UPDATE ca_id = VALUES(ca_id), status = 'Filled'
    `, [itrId, caId]);

    // 4. Update itr_flow with CA assignment info
    await pool.query(
      'UPDATE itr_flow SET ca_id = ?, ca_assign_date = CURRENT_TIMESTAMP WHERE itr_id = ? AND ca_assign_date IS NULL',
      [caId, itrId]
    );

    res.json({ message: 'CA assigned/updated successfully', caName: caRows[0].name });
  } catch (error) {
    console.error('Error assigning CA to ITR:', error);
    res.status(500).json({ error: 'Failed to assign CA to ITR' });
  }
});

// Remove customer allotment from CA
router.delete('/cas/:caId/allot-customers/:customerId', requireSuperadmin, async (req, res) => {
  const { caId, customerId } = req.params;

  try {
    // Verify the allotment exists via ITRs
    const [rows] = await pool.query('SELECT ci.id FROM ca_itr ci JOIN itr i ON ci.itr_id = i.id WHERE i.customer_id = ? AND ci.ca_id = ?', [customerId, caId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer allotment not found' });
    }

    // Delete the allotment record
    await pool.query('DELETE ci FROM ca_itr ci JOIN itr i ON ci.itr_id = i.id WHERE i.customer_id = ? AND ci.ca_id = ?', [customerId, caId]);

    res.json({ message: 'Customer allotment removed successfully' });
  } catch (error) {
    console.error('Error removing customer allotment:', error);
    res.status(500).json({ error: 'Failed to remove customer allotment' });
  }
});

// Get agent permissions
router.get('/agents/:id/permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [permissions] = await pool.query('SELECT permissions FROM agent_permissions WHERE agent_id = ?', [id]);
    res.json(permissions.length > 0 ? JSON.parse(permissions[0].permissions) : []);
  } catch (error) {
    console.error('Error fetching agent permissions:', error);
    res.status(500).json({ error: 'Failed to fetch agent permissions' });
  }
});

// Update agent permissions
router.put('/agents/:id/permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body; // array of permission strings
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions must be an array' });
  }
  try {
    // Delete existing permissions
    await pool.query('DELETE FROM agent_permissions WHERE agent_id = ?', [id]);
    // Insert new permissions
    if (permissions.length > 0) {
      await pool.query('INSERT INTO agent_permissions (agent_id, permissions) VALUES (?, ?)', [id, JSON.stringify(permissions)]);
    }
    res.json({ message: 'Agent permissions updated successfully' });
  } catch (error) {
    console.error('Error updating agent permissions:', error);
    res.status(500).json({ error: 'Failed to update agent permissions' });
  }
});

// Get subadmin agent permissions
router.get('/subadmins/:id/agent-permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM subadmin_permission_agent WHERE subadmin_permissions_id IN (SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?)', [id, 'manage_agents']);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json({ name: 0, father_name: 0, mobile_no: 0, mail_id: 0, address: 0, profile_photo: 0, alternate_mobile_no: 0, password: 0, wbalance: 0 });
    }
  } catch (error) {
    console.error('Error fetching subadmin agent permissions:', error);
    res.status(500).json({ error: 'Failed to fetch subadmin agent permissions' });
  }
});

// Update subadmin agent permissions
router.put('/subadmins/:id/agent-permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, password, wbalance } = req.body;
  try {
    const [permRows] = await pool.query('SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?', [id, 'manage_agents']);
    if (permRows.length === 0) {
      return res.status(404).json({ error: 'Manage agents permission not found' });
    }
    const permId = permRows[0].id;
    const [existing] = await pool.query('SELECT id FROM subadmin_permission_agent WHERE subadmin_permissions_id = ?', [permId]);
    if (existing.length > 0) {
      await pool.query('UPDATE subadmin_permission_agent SET name = ?, father_name = ?, mobile_no = ?, mail_id = ?, address = ?, profile_photo = ?, alternate_mobile_no = ?, password = ?, wbalance = ? WHERE subadmin_permissions_id = ?', [name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, password, wbalance, permId]);
    } else {
      await pool.query('INSERT INTO subadmin_permission_agent (subadmin_permissions_id, name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, password, wbalance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [permId, name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, password, wbalance]);
    }
    res.json({ message: 'Subadmin agent permissions updated successfully' });
  } catch (error) {
    console.error('Error updating subadmin agent permissions:', error);
    res.status(500).json({ error: 'Failed to update subadmin agent permissions' });
  }
});

// Get subadmin customer permissions
router.get('/subadmins/:id/customer-permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM Subadmin_customer_permission WHERE subadmin_permissions_id IN (SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?)', [id, 'manage_itr']);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json({ name: 0, father_name: 0, dob: 0, pan_number: 0, adhar_number: 0, account_number: 0, bank_name: 0, ifsc_code: 0, tds_amount: 0, itr_password: 0, asst_year_3yr: 0, income_type: 0, mobile_no: 0, mail_id: 0, filling_type: 0, last_ay_income: 0, profile_photo: 0, user_id: 0, password: 0, attachments_1: 0, attachments_2: 0, attachments_3: 0, attachments_4: 0, attachments_5: 0, file_charge: 0, apply_date: 0, updated_date: 0, income_slab: 0, comment_box: 0, customer_type: 0 });
    }
  } catch (error) {
    console.error('Error fetching subadmin customer permissions:', error);
    res.status(500).json({ error: 'Failed to fetch subadmin customer permissions' });
  }
});

// Update subadmin customer permissions
router.put('/subadmins/:id/customer-permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type } = req.body;
  try {
    const [permRows] = await pool.query('SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?', [id, 'manage_itr']);
    if (permRows.length === 0) {
      return res.status(404).json({ error: 'Manage agents permission not found' });
    }
    const permId = permRows[0].id;
    const [existing] = await pool.query('SELECT id FROM subadmin_customer_permission WHERE subadmin_permissions_id = ?', [permId]);
    if (existing.length > 0) {
      await pool.query('UPDATE Subadmin_customer_permission SET name = ?, father_name = ?, dob = ?, pan_number = ?, adhar_number = ?, account_number = ?, bank_name = ?, ifsc_code = ?, tds_amount = ?, itr_password = ?, asst_year_3yr = ?, income_type = ?, mobile_no = ?, mail_id = ?, filling_type = ?, last_ay_income = ?, profile_photo = ?, user_id = ?, password = ?, attachments_1 = ?, attachments_2 = ?, attachments_3 = ?, attachments_4 = ?, attachments_5 = ?, file_charge = ?, apply_date = ?, updated_date = ?, income_slab = ?, comment_box = ?, customer_type = ? WHERE subadmin_permissions_id = ?', [name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type, permId]);
    } else {
      await pool.query('INSERT INTO Subadmin_customer_permission (subadmin_permissions_id, name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [permId, name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type]);
    }
    res.json({ message: 'Subadmin customer permissions updated successfully' });
  } catch (error) {
    console.error('Error updating subadmin customer permissions:', error);
    res.status(500).json({ error: 'Failed to update subadmin customer permissions' });
  }
});

// Get CA customer permissions
router.get('/cas/:id/customer-permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM ca_customer_permission WHERE ca_permissions_id IN (SELECT id FROM ca_permissions WHERE ca_id = ? AND permission = ?)', [id, 'manage_itr']);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json({ name: 0, father_name: 0, dob: 0, pan_number: 0, adhar_number: 0, account_number: 0, bank_name: 0, ifsc_code: 0, tds_amount: 0, itr_password: 0, asst_year_3yr: 0, income_type: 0, mobile_no: 0, mail_id: 0, filling_type: 0, last_ay_income: 0, profile_photo: 0, user_id: 0, password: 0, attachments_1: 0, attachments_2: 0, attachments_3: 0, attachments_4: 0, attachments_5: 0, file_charge: 0, apply_date: 0, updated_date: 0, income_slab: 0, comment_box: 0, customer_type: 0 });
    }
  } catch (error) {
    console.error('Error fetching CA customer permissions:', error);
    res.status(500).json({ error: 'Failed to fetch CA customer permissions' });
  }
});

// Update CA customer permissions
router.put('/cas/:id/customer-permissions', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type } = req.body;
  try {
    const [permRows] = await pool.query('SELECT id FROM ca_permissions WHERE ca_id = ? AND permission = ?', [id, 'manage_itr']);
    if (permRows.length === 0) {
      return res.status(404).json({ error: 'Manage ITR permission not found' });
    }
    const permId = permRows[0].id;
    const [existing] = await pool.query('SELECT id FROM ca_customer_permission WHERE ca_permissions_id = ?', [permId]);
    if (existing.length > 0) {
      await pool.query('UPDATE ca_customer_permission SET name = ?, father_name = ?, dob = ?, pan_number = ?, adhar_number = ?, account_number = ?, bank_name = ?, ifsc_code = ?, tds_amount = ?, itr_password = ?, asst_year_3yr = ?, income_type = ?, mobile_no = ?, mail_id = ?, filling_type = ?, last_ay_income = ?, profile_photo = ?, user_id = ?, password = ?, attachments_1 = ?, attachments_2 = ?, attachments_3 = ?, attachments_4 = ?, attachments_5 = ?, file_charge = ?, apply_date = ?, updated_date = ?, income_slab = ?, comment_box = ?, customer_type = ? WHERE ca_permissions_id = ?', [name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type, permId]);
    } else {
      await pool.query('INSERT INTO ca_customer_permission (ca_permissions_id, name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [permId, name, father_name, dob, pan_number, adhar_number, account_number, bank_name, ifsc_code, tds_amount, itr_password, asst_year_3yr, income_type, mobile_no, mail_id, filling_type, last_ay_income, profile_photo, user_id, password, attachments_1, attachments_2, attachments_3, attachments_4, attachments_5, file_charge, apply_date, updated_date, income_slab, comment_box, customer_type]);
    }
    res.json({ message: 'CA customer permissions updated successfully' });
  } catch (error) {
    console.error('Error updating CA customer permissions:', error);
    res.status(500).json({ error: 'Failed to update CA customer permissions' });
  }
});

// Get flow data for superadmin
router.get('/flow', requireSuperadmin, async (req, res) => {
  try {
    const [flows] = await pool.query(`
      SELECT 
        itr.customer_id,
        customer.name as customer_name,
        itr.agent_id,
        agent.name as agent_name,
        subadmin_itr.subadmin_id,
        subadmin.username as subadmin_username,
        ca_itr.ca_id,
        ca.name as ca_name
      FROM itr
      LEFT JOIN customer ON itr.customer_id = customer.id
      LEFT JOIN agent ON itr.agent_id = agent.id
      LEFT JOIN subadmin_itr ON itr.id = subadmin_itr.itr_id
      LEFT JOIN subadmin ON subadmin_itr.subadmin_id = subadmin.id
      LEFT JOIN ca_itr ON itr.id = ca_itr.itr_id
      LEFT JOIN ca ON ca_itr.ca_id = ca.id
    `);

    // Filter out null values for subadmin and ca
    const result = flows.map(flow => {
      const filteredFlow = {
        customer_id: flow.customer_id,
        customer_name: flow.customer_name,
        agent_id: flow.agent_id,
        agent_name: flow.agent_name
      };
      if (flow.subadmin_id) {
        filteredFlow.subadmin_id = flow.subadmin_id;
        filteredFlow.subadmin_username = flow.subadmin_username;
      }
      if (flow.ca_id) {
        filteredFlow.ca_id = flow.ca_id;
        filteredFlow.ca_name = flow.ca_name;
      }
      return filteredFlow;
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching flow data:', error);
    res.status(500).json({ error: 'Failed to fetch flow data' });
  }
});

// Get detailed flow and rejection history for a specific ITR
router.get('/itr-flow/:itrId', requireSuperadmin, async (req, res) => {
  const { itrId } = req.params;
  try {
    // 1. Fetch the main flow milestones
    const [flowRows] = await pool.query(`
      SELECT f.*, 
             c.name as customer_name,
             s.username as subadmin_username,
             ca.name as ca_name
      FROM itr_flow f
      JOIN customer c ON f.customer_id = c.id
      LEFT JOIN subadmin s ON f.subadmin_id = s.id
      LEFT JOIN ca ca ON f.ca_id = ca.id
      WHERE f.itr_id = ?
    `, [itrId]);

    if (flowRows.length === 0) {
      return res.status(404).json({ error: 'Flow data not found for this ITR' });
    }

    // 2. Fetch the rejection history
    const [rejectionRows] = await pool.query(`
      SELECT rh.*,
             CASE 
               WHEN rh.rejected_by_type = 'subadmin' THEN (SELECT username FROM subadmin WHERE id = rh.rejected_by_id)
               WHEN rh.rejected_by_type = 'ca' THEN (SELECT name FROM ca WHERE id = rh.rejected_by_id)
               WHEN rh.rejected_by_type = 'superadmin' THEN 'Superadmin'
             END as rejected_by_name
      FROM itr_rejection_history rh
      WHERE rh.itr_id = ?
      ORDER BY rh.created_at ASC
    `, [itrId]);

    res.json({
      flow: flowRows[0],
      rejections: rejectionRows
    });
  } catch (error) {
    console.error('Error fetching ITR flow history:', error);
    res.status(500).json({ error: 'Failed to fetch ITR flow history' });
  }
});

// Delete a specific document reference
router.delete('/itr/:itrId/document/:fieldName', requireSuperadmin, async (req, res) => {
  const { itrId, fieldName } = req.params;

  // Define which fields belong to which table
  const itrFields = ['Ca_doc1', 'Ca_doc2', 'Ca_doc3', 'Subadmin_doc1', 'Subadmin_doc2', 'Superadmin_doc1'];
  const customerFields = ['attachments_1', 'attachments_2', 'attachments_3', 'attachments_4', 'attachments_5'];

  try {
    if (itrFields.includes(fieldName)) {
      await pool.query(`UPDATE itr SET ${fieldName} = NULL WHERE id = ?`, [itrId]);
    } else if (customerFields.includes(fieldName)) {
      await pool.query(`
        UPDATE customer c
        JOIN itr i ON c.id = i.customer_id
        SET c.${fieldName} = NULL
        WHERE i.id = ?
      `, [itrId]);
    } else {
      return res.status(400).json({ error: 'Invalid document field' });
    }

    res.json({ message: 'Document reference removed successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Re-upload a document
router.put('/itr/:itrId/document/:fieldName', requireSuperadmin, upload.single('document'), async (req, res) => {
  const { itrId, fieldName } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const itrFields = ['Ca_doc1', 'Ca_doc2', 'Ca_doc3', 'Subadmin_doc1', 'Subadmin_doc2', 'Superadmin_doc1'];
  const customerFields = ['attachments_1', 'attachments_2', 'attachments_3', 'attachments_4', 'attachments_5'];

  try {
    // Generate file path and URL (consistent with upload.js)
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(req.file.originalname) || '.pdf';
    const fileName = `reupload_${itrId}_${fieldName}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, req.file.buffer);
    const fileUrl = `${fileName}`;

    if (itrFields.includes(fieldName)) {
      await pool.query(`UPDATE itr SET ${fieldName} = ? WHERE id = ?`, [fileUrl, itrId]);
    } else if (customerFields.includes(fieldName)) {
      await pool.query(`
        UPDATE customer c
        JOIN itr i ON c.id = i.customer_id
        SET c.${fieldName} = ?
        WHERE i.id = ?
      `, [fileUrl, itrId]);
    } else {
      return res.status(400).json({ error: 'Invalid document field' });
    }

    res.json({ message: 'Document uploaded successfully', url: fileUrl });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Reject ITR
router.post('/reject-itr', requireSuperadmin, async (req, res) => {
  const { itr_id, reason, extra_charge } = req.body;

  if (!itr_id || !reason) {
    return res.status(400).json({ error: 'itr_id and reason are required' });
  }

  try {
    // 1. Update ITR table
    await pool.query(
      'UPDATE itr SET status = "Rejected", Comment = ?, extra_charge = ?, superadmin_send = FALSE WHERE id = ?',
      [reason, extra_charge || null, itr_id]
    );

    // 2. Update ca_itr and subadmin_itr status
    await pool.query('UPDATE ca_itr SET status = "Rejected" WHERE itr_id = ?', [itr_id]);
    await pool.query('UPDATE subadmin_itr SET status = "Rejected" WHERE itr_id = ?', [itr_id]);

    // 3. Log rejection in history
    await pool.query(
      'INSERT INTO itr_rejection_history (itr_id, rejected_by_type, rejected_by_id, reason, extra_charge) VALUES (?, "superadmin", 0, ?, ?)',
      [itr_id, reason, extra_charge || null]
    );

    res.json({ message: 'ITR rejected successfully' });
  } catch (error) {
    console.error('Error rejecting ITR:', error);
    res.status(500).json({ error: 'Failed to reject ITR' });
  }
});

// Update ITR details
router.put('/itrs/:id', requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const {
    name, father_name, dob, mobile_no, mail_id, pan_number, adhar_number,
    account_number, bank_name, ifsc_code, itr_password,
    asst_year, income_slab, comment_box
  } = req.body;

  try {
    // Format DOB to YYYY-MM-DD for MySQL
    let formattedDob = dob;
    if (dob) {
      const date = new Date(dob);
      if (!isNaN(date.getTime())) {
        formattedDob = date.toISOString().split('T')[0];
      }
    }

    const [userData] = await pool.query('Select * from itr_customer where itr_id = ?', [id]);

    // 1. Update itr_customer table (Personal, Financial, and Password Details)
    await pool.query(
      `UPDATE itr_customer SET 
        name = ?, father_name = ?, dob = ?, mobile_no = ?, mail_id = ?, 
        pan_number = ?, adhar_number = ?, account_number = ?, bank_name = ?, 
        ifsc_code = ?, itr_password = ?, income_slab = ?, comment_box = ?
       WHERE itr_id = ?`,
      [
        userData[0].name, father_name, formattedDob, mobile_no, mail_id,
        pan_number, adhar_number, account_number, bank_name,
        ifsc_code, itr_password, income_slab, comment_box,
        id
      ]
    );

    // 2. Update itr table (System Status & Year)
    await pool.query(
      `UPDATE itr SET 
        asst_year = ?, 
        updated_at = NOW() 
       WHERE id = ?`,
      [
        asst_year,
        id
      ]
    );

    // 3. Fetch updated ITR data (joining details)
    const [updatedITR] = await pool.query(`
      SELECT 
        i.*, 
        ic.name, ic.father_name, ic.dob, ic.mobile_no, ic.mail_id, 
        ic.pan_number, ic.adhar_number, ic.account_number, ic.bank_name, ic.ifsc_code,
        ic.itr_password, ic.income_slab, ic.comment_box
      FROM itr i
      LEFT JOIN itr_customer ic ON i.id = ic.itr_id
      WHERE i.id = ?
    `, [id]);

    if (updatedITR.length === 0) {
      return res.status(404).json({ error: 'ITR not found' });
    }

    res.json(updatedITR[0]);
  } catch (error) {
    console.error('Error updating ITR:', error);
    res.status(500).json({ error: 'Failed to update ITR', details: error.message });
  }
});

export default router;
