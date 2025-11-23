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

// Get all agents with their permissions
router.get('/agents', requireSuperadmin, async (req, res) => {
  try {
    const [agents] = await pool.query(`
      SELECT a.id, a.name, a.father_name, a.mobile_no, a.mail_id, a.address, a.profile_photo, a.alternate_mobile_no, a.isagent, a.wbalance,
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
      SELECT s.id, s.username, s.issubadmin,
             GROUP_CONCAT(sp.permission SEPARATOR ',') as permissions
      FROM subadmin s
      LEFT JOIN subadmin_permissions sp ON s.id = sp.subadmin_id
      GROUP BY s.id, s.username, s.issubadmin
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

    // Handle subadmin_permission_agent table for manage_agents permission
    const hasManageAgents = permissions.includes('manage_agents');
    if (hasManageAgents) {
      // Get the permission id for manage_agents
      const [permRows] = await pool.query('SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?', [id, 'manage_agents']);
      if (permRows.length > 0) {
        const permId = permRows[0].id;
        // Check if record already exists
        const [existing] = await pool.query('SELECT id FROM subadmin_permission_agent WHERE subadmin_permissions_id = ?', [permId]);
        if (existing.length === 0) {
          // Insert new record with all fields set to 1
          await pool.query('INSERT INTO subadmin_permission_agent (subadmin_permissions_id, name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, password, wbalance) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0)', [permId]);
        }
      }
    } else {
      // Delete any existing record for manage_agents
      await pool.query('DELETE FROM subadmin_permission_agent WHERE subadmin_permissions_id IN (SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?)', [id, 'manage_agents']);
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
      SELECT c.id, c.name, c.username, c.email, c.isca,
             GROUP_CONCAT(cp.permission SEPARATOR ',') as permissions
      FROM ca c
      LEFT JOIN ca_permissions cp ON c.id = cp.ca_id
      GROUP BY c.id, c.name, c.username, c.email, c.isca
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
      SELECT c.*, si.subadmin_id as assignedSubadminId
      FROM customer c
      LEFT JOIN subadmin_itr si ON c.id = si.customer_id
    `;
    let params = [];

    if (caId) {
      query += ` LEFT JOIN ca_itr ci ON c.id = ci.customer_id AND ci.ca_id = ?`;
      params.push(caId);
    }

    const [customers] = await pool.query(query, params);

    // If caId is provided, add assignedCAId
    if (caId) {
      const customersWithCA = customers.map(customer => ({
        ...customer,
        assignedCAId: customer.ca_id || null // Assuming the join adds ca_id if assigned
      }));
      res.json(customersWithCA);
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
      SELECT itr.id, customer.name as customer_name, itr.status, itr.agent_id, itr.created_at
      FROM itr
      LEFT JOIN customer ON itr.customer_id = customer.id
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

    // Insert records into subadmin_itr table
    const values = customerIds.map(customerId => [customerId, subadminId]);
    await pool.query('INSERT INTO subadmin_itr (customer_id, subadmin_id) VALUES ?', [values]);

    // Update customer table to set subadmin_send = TRUE
    await pool.query('UPDATE customer SET subadmin_send = TRUE WHERE id IN (?)', [customerIds]);

    res.json({ message: 'Customers allotted to subadmin successfully' });
  } catch (error) {
    console.error('Error allotting customers to subadmin:', error);
    res.status(500).json({ error: 'Failed to allot customers to subadmin' });
  }
});

// Remove customer allotment from subadmin
router.delete('/subadmins/:subadminId/allot-customers/:customerId', requireSuperadmin, async (req, res) => {
  const { subadminId, customerId } = req.params;

  try {
    // Verify the allotment exists
    const [rows] = await pool.query('SELECT id FROM subadmin_itr WHERE customer_id = ? AND subadmin_id = ?', [customerId, subadminId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer allotment not found' });
    }

    // Delete the allotment record
    await pool.query('DELETE FROM subadmin_itr WHERE customer_id = ? AND subadmin_id = ?', [customerId, subadminId]);

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

    // Insert records into ca_itr table (only ca_id and customer_id, leave other fields blank)
    const values = customerIds.map(customerId => [customerId, caId]);
    await pool.query('INSERT INTO ca_itr (customer_id, ca_id) VALUES ?', [values]);

    res.json({ message: 'Customers allotted to CA successfully' });
  } catch (error) {
    console.error('Error allotting customers to CA:', error);
    res.status(500).json({ error: 'Failed to allot customers to CA' });
  }
});

// Remove customer allotment from CA
router.delete('/cas/:caId/allot-customers/:customerId', requireSuperadmin, async (req, res) => {
  const { caId, customerId } = req.params;

  try {
    // Verify the allotment exists
    const [rows] = await pool.query('SELECT id FROM ca_itr WHERE customer_id = ? AND ca_id = ?', [customerId, caId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer allotment not found' });
    }

    // Delete the allotment record
    await pool.query('DELETE FROM ca_itr WHERE customer_id = ? AND ca_id = ?', [customerId, caId]);

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

export default router;
