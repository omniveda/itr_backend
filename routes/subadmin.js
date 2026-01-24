import express from 'express';
import { pool } from '../db.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Multer config for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

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
      SELECT s.id, i.customer_id, i.agent_id, i.created_at AS sent_at,
             ic.name AS customer_name, ic.pan_number, ic.mobile_no AS customer_mobile, ic.mail_id AS customer_email, ic.dob,
             a.name AS agent_name, a.mobile_no AS agent_mobile
      FROM subadmin_itr s
      JOIN itr i ON s.itr_id = i.id
      JOIN itr_customer ic ON i.id = ic.itr_id
      JOIN agent a ON i.agent_id = a.id
      ORDER BY i.created_at DESC
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

// GET /api/subadmin/customers-itr
// Returns ITR data joined with customer data for customers in subadmin_itr, along with customer field permissions
router.get('/customers-itr', authenticateToken, async (req, res) => {
  try {
    // Get customer field permissions for the subadmin
    const [permRows] = await pool.query(`
      SELECT scp.* FROM subadmin_customer_permission scp
      JOIN subadmin_permissions sp ON scp.subadmin_permissions_id = sp.id
      WHERE sp.subadmin_id = ?
    `, [req.subadminId]);
    console.log('Subadmin customer permissions:', permRows);

    let permissions = {};
    if (permRows.length > 0) {
      const perm = permRows[0];
      permissions = {
        name: perm.name,
        father_name: perm.father_name,
        dob: perm.dob,
        pan_number: perm.pan_number,
        adhar_number: perm.adhar_number,
        account_number: perm.account_number,
        bank_name: perm.bank_name,
        ifsc_code: perm.ifsc_code,
        tds_amount: perm.tds_amount,
        itr_password: perm.itr_password,
        asst_year_3yr: perm.asst_year_3yr,
        income_type: perm.income_type,
        mobile_no: perm.mobile_no,
        mail_id: perm.mail_id,
        filling_type: perm.filling_type,
        last_ay_income: perm.last_ay_income,
        profile_photo: perm.profile_photo,
        user_id: perm.user_id,
        password: perm.password,
        attachments_1: perm.attachments_1,
        attachments_2: perm.attachments_2,
        attachments_3: perm.attachments_3,
        attachments_4: perm.attachments_4,
        attachments_5: perm.attachments_5,
        file_charge: perm.file_charge,
        apply_date: perm.apply_date,
        updated_date: perm.updated_date,
        income_slab: perm.income_slab,
        comment_box: perm.comment_box,
        customer_type: perm.customer_type
      };
    }

    // Get ITR flow permissions for the subadmin
    const [flowPermRows] = await pool.query('SELECT * FROM subadmin_itr_permissions WHERE subadmin_id = ?', [req.subadminId]);
    let flowPermissions = {};
    if (flowPermRows.length > 0) {
      flowPermissions = flowPermRows[0];
    } else {
      // Default all true if no record exists yet (should be created by superadmin view)
      flowPermissions = { pending: 1, in_progress: 1, e_verification: 1, completed: 1, rejected: 1, flow: 1, ca_change: 1, recharge_not: 1, itr_history: 1 };
    }

    const [rows] = await pool.query(`
      SELECT ic.*, itr.asst_year, itr.status, itr.id as itr_id, itr.agentedit, itr.ca_id,
             itr.Subadmin_doc1, itr.Subadmin_doc2, 
             itr.Ca_doc1, itr.Ca_doc2, itr.Ca_doc3,
             itr.Superadmin_doc1
      FROM itr_customer ic
      JOIN itr ON ic.itr_id = itr.id
      LEFT JOIN subadmin_itr si ON itr.id = si.itr_id
      WHERE itr.status = 'Pending' OR si.subadmin_id = ?
    `, [req.subadminId]);
    res.json({ data: rows, permissions, flowPermissions });
  } catch (error) {
    console.error('Error fetching customers ITR:', error);
    res.status(500).json({ message: 'Failed to fetch customers ITR' });
  }
});

// GET /api/subadmin/agents - List agents (subadmin must have manage_agents permission)
// If subadmin doesn't have the manage_agents permission, return an empty array.
router.get('/agents', authenticateToken, async (req, res) => {
  try {
    // Check manage_agents permission for this subadmin
    const [permRows] = await pool.query('SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?', [req.subadminId, 'manage_agents']);
    if (permRows.length === 0) {
      // If subadmin does not have manage_agents permission, return empty array (hide data)
      return res.json([]);
    }

    // Check field-level permissions for subadmin for agent fields like wbalance
    const permId = permRows[0].id;
    const [permAgentRows] = await pool.query('SELECT * FROM subadmin_permission_agent WHERE subadmin_permissions_id = ?', [permId]);
    const permAgent = permAgentRows.length > 0 ? permAgentRows[0] : null;
    const canViewWbalance = permAgent ? !!permAgent.wbalance : true;

    const [agents] = await pool.query(`
      SELECT a.id, a.name, a.father_name, a.mobile_no, a.mail_id, a.address, a.profile_photo, a.alternate_mobile_no, a.isagent, a.file_charge, a.wbalance
      FROM agent a
    `);

    // Remove wbalance from results if subadmin doesn't have permission
    const result = agents.map(a => ({
      ...a
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching agents for subadmin:', error);
    res.status(500).json({ message: 'Failed to fetch agents' });
  }
});

// PUT /api/subadmin/agents/:id/verify - Toggle agent verification (subadmin must have manage_agents permission)
router.put('/agents/:id/verify', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Check manage_agents permission for this subadmin
    const [permRows] = await pool.query('SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?', [req.subadminId, 'manage_agents']);
    if (permRows.length === 0) {
      // If subadmin doesn't have manage_agents permission, return 403 Forbidden (no action allowed)
      return res.status(403).json({ message: 'Access denied. Manage agents permission required.' });
    }

    // Get current status
    const [rows] = await pool.query('SELECT isagent FROM agent WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const currentStatus = rows[0].isagent;
    const newStatus = currentStatus === 'verified' ? 'unverified' : 'verified';

    await pool.query('UPDATE agent SET isagent = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `Agent ${newStatus} successfully`, isagent: newStatus });
  } catch (error) {
    console.error('Error updating agent verification by subadmin:', error);
    res.status(500).json({ message: 'Failed to update agent verification' });
  }
});

// PUT /api/subadmin/toggle-agentedit/:itrId
// Toggle the agentedit field for a specific ITR
router.put('/toggle-agentedit/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;

  try {
    // Check if the ITR exists and is associated with the subadmin
    const [rows] = await pool.query(`
      SELECT itr.agentedit
      FROM itr
      WHERE itr.id = ?
    `, [itrId]);
    // console.log('ITR rows for toggle-agentedit: itrId',itrId,"req.subadminId", req.subadminId );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'ITR not found or not accessible' });
    }

    const currentAgentEdit = rows[0].agentedit;
    const newAgentEdit = currentAgentEdit ? 0 : 1;
    // console.log("Rows data", rows.id);

    await pool.query('UPDATE itr SET agentedit = ? WHERE id = ?', [newAgentEdit, itrId]);

    res.json({ message: 'Agent edit toggled successfully', agentedit: newAgentEdit });
  } catch (error) {
    console.error('Error toggling agent edit:', error);
    res.status(500).json({ message: 'Failed to toggle agent edit' });
  }
});

// GET /api/subadmin/agent-permissions - Return subadmin's agent field permissions (for manage_agents)
router.get('/agent-permissions', authenticateToken, async (req, res) => {
  try {
    const [permRows] = await pool.query('SELECT id FROM subadmin_permissions WHERE subadmin_id = ? AND permission = ?', [req.subadminId, 'manage_agents']);
    if (permRows.length === 0) {
      // Return default object with zeroed fields
      return res.json({ name: 0, father_name: 0, mobile_no: 0, mail_id: 0, address: 0, profile_photo: 0, alternate_mobile_no: 0, password: 0, wbalance: 0 });
    }
    const permId = permRows[0].id;
    const [rows] = await pool.query('SELECT * FROM subadmin_permission_agent WHERE subadmin_permissions_id = ?', [permId]);
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

// PUT /api/subadmin/update-customer/:itrId
// Update customer snapshot data in itr_customer table
router.put('/update-customer/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;
  const updates = req.body;
  console.log("ITR ID snapshot update", itrId, "update data", updates);

  // Protected fields that subadmin cannot update in snapshot
  const protectedFields = ['id', 'itr_id', 'agent_id', 'created_at', 'updated_at', 'pan_number', 'adhar_number', 'name', 'mobile_no', 'dob', 'asst_year', 'customer_id', 'agentedit', 'status', 'ca_upload', 'subadmin_send', 'ca_send', 'ca_id', 'superadmin_send', 'otp_check', 'Subadmin_doc1', 'Subadmin_doc2', 'Ca_doc1', 'Ca_doc2', 'Ca_doc3', 'Superadmin_doc1', 'Comment', 'extra_charge', 'snapshot_date', 'customer_agent_id', 'paid', 'sent_at'];

  // Remove protected fields from updates
  protectedFields.forEach(field => delete updates[field]);

  // Check if there are any fields to update
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  try {
    // Check if the snapshot exists
    const [snapshotRows] = await pool.query(`
      SELECT ic.*
      FROM itr_customer ic
      WHERE ic.itr_id = ?
    `, [itrId]);

    if (snapshotRows.length === 0) {
      return res.status(404).json({ message: 'ITR customer snapshot not found' });
    }

    const customer = snapshotRows[0];

    // Check which fields are already filled by agent (not null and not empty)
    const filledByAgent = [];
    Object.keys(updates).forEach(field => {
      if (customer[field] !== null && customer[field] !== '') {
        filledByAgent.push(field);
      }
    });

    // if (filledByAgent.length > 0) {
    //   return res.status(400).json({
    //     message: 'Cannot update fields already filled by agent',
    //     filledByAgent
    //   });
    // }

    // Handle password hashing
    if (updates.password) {
      const bcrypt = await import('bcrypt');
      updates.password = await bcrypt.default.hash(updates.password, 10);
    }

    // Build update query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    await pool.query(
      `UPDATE itr_customer SET ${setClause} WHERE itr_id = ?`,
      [...values, itrId]
    );

    res.json({ message: 'ITR customer snapshot updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Failed to update customer' });
  }
});

// PUT /api/subadmin/assign-ca/:itrId
// Assign or update CA for a specific ITR
router.put('/assign-ca/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;
  const { caId } = req.body;

  if (!caId) {
    return res.status(400).json({ message: 'CA ID is required' });
  }

  try {
    // Check if the ITR exists
    const [itrRows] = await pool.query(`
      SELECT id, customer_id, agent_id
      FROM itr WHERE id = ?
    `, [itrId]);

    if (itrRows.length === 0) {
      return res.status(404).json({ message: 'ITR not found or not accessible' });
    }

    // Update the ca_id and ca_send in itr table
    await pool.query('UPDATE itr SET ca_id = ?, ca_send = TRUE, status = "Filled" WHERE id = ?', [caId, itrId]);

    await pool.query('UPDATE subadmin_itr SET status = "Filled" WHERE itr_id = ?', [itrId]);

    await pool.query(
      'UPDATE itr_flow SET ca_id = ?, ca_assign_date = CURRENT_TIMESTAMP WHERE itr_id = ? AND ca_assign_date IS NULL',
      [caId, itrId]
    );


    // Delete the last record for this customer_id if it exists
    // await pool.query(`
    //   DELETE FROM ca_itr
    //   WHERE itr_id = ?
    //   ORDER BY id DESC
    //   LIMIT 1
    // `, [itrId]);

    // Insert the new record into the ca_itr table
    await pool.query(`
      INSERT INTO ca_itr (itr_id, ca_id,status)
      VALUES (?, ?,?)
    `, [itrId, caId, 'Filled']);

    res.json({ message: 'CA assigned successfully' });
  } catch (error) {
    console.error('Error assigning CA:', error);
    res.status(500).json({ message: 'Failed to assign CA' });
  }
});

// POST /api/subadmin/upload-subadmin-doc/:itrId
// Upload subadmin documents (Subadmin_doc1 or Subadmin_doc2)
router.post('/upload-subadmin-doc/:itrId', authenticateToken, upload.single('file'), async (req, res) => {
  const { itrId } = req.params;
  const { docType } = req.body; // 'Subadmin_doc1' or 'Subadmin_doc2'

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  if (!docType || !['Subadmin_doc1', 'Subadmin_doc2'].includes(docType)) {
    return res.status(400).json({ message: 'Invalid docType. Must be Subadmin_doc1 or Subadmin_doc2' });
  }

  try {
    // Check if the ITR exists
    const [itrRows] = await pool.query(`
      SELECT id FROM itr WHERE id = ?
    `, [itrId]);

    if (itrRows.length === 0) {
      return res.status(404).json({ message: 'ITR not found or not accessible' });
    }

    // Create unique filename
    const fileName = `subadmin_doc_${itrId}_${docType}_${Date.now()}.pdf`;
    const filePath = path.join(process.cwd(), 'uploads', fileName);

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Write file to local system
    fs.writeFileSync(filePath, req.file.buffer);

    // Create URL for accessing the file
    const fileUrl = `http://85.217.170.83/api/uploads/${fileName}`;

    // Update the itr table with the document URL
    await pool.query(`UPDATE itr SET ${docType} = ? WHERE id = ?`, [fileUrl, itrId]);

    res.json({ message: 'Document uploaded successfully', url: fileUrl });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
});

// DELETE /api/subadmin/remove-subadmin-doc/:itrId
// Allows subadmin to remove an uploaded document before it is sent to CA
router.delete('/remove-subadmin-doc/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;
  const { docType } = req.query; // 'Subadmin_doc1' or 'Subadmin_doc2'

  if (!docType || !['Subadmin_doc1', 'Subadmin_doc2'].includes(docType)) {
    return res.status(400).json({ message: 'Invalid docType. Must be Subadmin_doc1 or Subadmin_doc2' });
  }

  try {
    // Check if the ITR exists and if it has been sent to CA
    const [itrRows] = await pool.query(
      'SELECT id, ca_send FROM itr WHERE id = ?',
      [itrId]
    );

    if (itrRows.length === 0) {
      return res.status(404).json({ message: 'ITR not found' });
    }

    const itr = itrRows[0];
    if (itr.ca_send) {
      return res.status(403).json({ message: 'Cannot remove documents after CA assignment' });
    }

    // Update the column to NULL
    await pool.query(`UPDATE itr SET ${docType} = NULL WHERE id = ?`, [itrId]);

    res.json({ message: 'Document removed successfully' });
  } catch (error) {
    console.error('Error removing document:', error);
    res.status(500).json({ message: 'Failed to remove document' });
  }
});

// POST /api/subadmin/take-itr/:itrId
// Subadmin "takes" an ITR, updating its status and logging it in subadmin_itr
router.post('/take-itr/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;
  const subadminId = req.subadminId;

  try {
    // 1. Update status in itr table
    await pool.query('UPDATE itr SET status = ? WHERE id = ?', ['In Progress', itrId]);

    // 2. Upsert into subadmin_itr
    const [existing] = await pool.query('SELECT id FROM subadmin_itr WHERE itr_id = ? AND subadmin_id = ?', [itrId, subadminId]);

    if (existing.length > 0) {
      await pool.query('UPDATE subadmin_itr SET status = ? WHERE itr_id = ? AND subadmin_id = ?', ['In Progress', itrId, subadminId]);
    } else {
      // Fetch customer_id to keep subadmin_itr consistent
      const [itrRow] = await pool.query('SELECT customer_id FROM itr WHERE id = ?', [itrId]);
      if (itrRow.length === 0) {
        return res.status(404).json({ message: 'ITR not found' });
      }
      const customerId = itrRow[0].customer_id;
      await pool.query('INSERT INTO subadmin_itr (itr_id, subadmin_id, status) VALUES (?, ?, ?)', [itrId, subadminId, 'In Progress']);
    }

    // Update itr_flow with subadmin take info
    await pool.query(
      'UPDATE itr_flow SET subadmin_id = ?, subadmin_take_date = CURRENT_TIMESTAMP WHERE itr_id = ? AND subadmin_take_date IS NULL',
      [subadminId, itrId]
    );

    res.json({ message: 'ITR taken successfully', status: 'In Progress' });
  } catch (error) {
    console.error('Error taking ITR:', error);
    res.status(500).json({ message: 'Failed to take ITR' });
  }
});


// POST /api/subadmin/reject-itr/:itrId
// Allows subadmin to reject an ITR (sets status to Rejected and records a comment)
router.post('/reject-itr/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;
  const { comment, extra_charge } = req.body;

  if (!comment) {
    return res.status(400).json({ message: 'Rejection comment is required' });
  }

  try {
    // 1. Update status, comment, and extra_charge in itr table
    await pool.query('UPDATE itr SET status = ?, Comment = ?, extra_charge = ? WHERE id = ?', ['Rejected', comment, extra_charge || null, itrId]);

    // 2. Update status in subadmin_itr table
    await pool.query('UPDATE subadmin_itr SET status = ? WHERE itr_id = ?', ['Rejected', itrId]);

    // 3. Log rejection in history
    const subadminId = req.subadminId;
    await pool.query(
      'INSERT INTO itr_rejection_history (itr_id, rejected_by_type, rejected_by_id, reason, extra_charge) VALUES (?, "subadmin", ?, ?, ?)',
      [itrId, subadminId, comment, extra_charge || null]
    );

    res.json({ message: 'ITR rejected successfully', status: 'Rejected' });
  } catch (error) {
    console.error('Error rejecting ITR:', error);
    res.status(500).json({ message: 'Failed to reject ITR' });
  }
});

// POST /api/subadmin/reapply-itr/:itrId
// Allows subadmin to mark a previously rejected ITR as reapplied (set status to In Progress and clear comment)
router.post('/reapply-itr/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;

  try {
    // Verify ITR exists
    const [rows] = await pool.query('SELECT id, status FROM itr WHERE id = ?', [itrId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ITR not found for this customer' });
    }

    const currentStatus = rows[0].status;
    if (currentStatus !== 'Rejected') {
      return res.status(400).json({ message: 'Only rejected ITRs can be reapplied' });
    }

    // Update status to Pending and clear comment field
    await pool.query('UPDATE itr SET status = ?, Comment = ?, ca_id = NULL, ca_send = 0 WHERE id = ?', ['Pending', '', itrId]);

    // Clean up associated assignments
    await pool.query('DELETE FROM ca_itr WHERE itr_id = ?', [itrId]);
    await pool.query('DELETE FROM subadmin_itr WHERE itr_id = ?', [itrId]);

    res.json({ message: 'ITR marked as Reapplied successfully. It can now be taken again.' });
  } catch (error) {
    console.error('Error reapplying ITR:', error);
    res.status(500).json({ message: 'Failed to reapply ITR' });
  }
});

// GET /api/subadmin/taken-itrs
// Fetch all ITRs that the current subadmin has "taken" (In Progress or Filled)
router.get('/taken-itrs', authenticateToken, async (req, res) => {
  const subadminId = req.subadminId;

  try {
    const [rows] = await pool.query(`
      SELECT * FROM subadmin_itr WHERE subadmin_id = ?
    `, [subadminId]);

    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching taken ITRs:', error);
    res.status(500).json({ message: 'Failed to fetch taken ITRs' });
  }
});

router.get('/rejected-itrs', authenticateToken, async (req, res) => {
  const subadminId = req.subadminId;
  try {
    const [rows] = await pool.query(`
      SELECT rh.*, ic.name, ic.pan_number, i.asst_year
      FROM itr_rejection_history rh
      JOIN itr i ON rh.itr_id = i.id
      JOIN itr_customer ic ON i.id = ic.itr_id
      WHERE rh.rejected_by_type = "subadmin" AND rh.rejected_by_id = ?
      ORDER BY rh.created_at DESC
    `, [subadminId]);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching rejected ITRs:', error);
    res.status(500).json({ message: 'Failed to fetch rejected ITRs' });
  }
});

// GET detailed flow and rejection history for a specific ITR
router.get('/itr-flow/:itrId', authenticateToken, async (req, res) => {
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


export default router;