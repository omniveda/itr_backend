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

    // Get ITR and customer data for customers sent to subadmin
    const [rows] = await pool.query(`
      SELECT itr.*, customer.*
      FROM itr
      JOIN customer ON itr.customer_id = customer.id
      JOIN subadmin_itr si ON customer.id = si.customer_id
      ORDER BY itr.id DESC
    `);

    res.json({ data: rows, permissions });
  } catch (error) {
    console.error('Error fetching customers-itr:', error);
    res.status(500).json({ message: 'Failed to fetch data' });
  }
});

// PUT /api/subadmin/toggle-agentedit/:itrId
// Toggle the agentedit field for a specific ITR
router.put('/toggle-agentedit/:itrId', authenticateToken, async (req, res) => {
  const { itrId } = req.params;

  try {
    // Check if the ITR exists and is associated with the subadmin
    const [rows] = await pool.query(`
      SELECT itr.id, itr.agentedit
      FROM itr
      JOIN subadmin_itr si ON itr.customer_id = si.customer_id
      WHERE itr.id = ? AND si.subadmin_id = ?
    `, [itrId, req.subadminId]);
    console.log('ITR rows for toggle-agentedit: itrId',itrId,"req.subadminId", req.subadminId );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'ITR not found or not accessible' });
    }

    const currentAgentEdit = rows[0].agentedit;
    const newAgentEdit = currentAgentEdit ? 0 : 1;

    await pool.query('UPDATE itr SET agentedit = ? WHERE id = ?', [newAgentEdit, itrId]);

    res.json({ message: 'Agent edit toggled successfully', agentedit: newAgentEdit });
  } catch (error) {
    console.error('Error toggling agent edit:', error);
    res.status(500).json({ message: 'Failed to toggle agent edit' });
  }
});

export default router;
