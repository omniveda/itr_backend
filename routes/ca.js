import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
const router = express.Router();

// Middleware to verify JWT token and check if user is CA
const authenticateCA = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isCA) {
      return res.status(403).json({ message: 'Access denied. CA privileges required.' });
    }
    req.caId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
// Get all ITRs assigned to a CA with customer data filtered by permissions
router.get('/assigned-itrs/:caId', authenticateCA, async (req, res) => {
  const caId = req.caId;
  try {

    const [permRows] = await pool.query(`
      SELECT ccp.* FROM ca_customer_permission ccp
      JOIN ca_permissions cp ON ccp.ca_permissions_id = cp.id
      WHERE cp.ca_id = ?
    `, [caId]);

    let permissions = permRows.length > 0 ? permRows[0] : null;
    console.log('CA Permissions:', permissions);
    console.log('CA Permissions:', permissions);

    // Build dynamic SELECT fields for ITR and customer
    let selectFields = [
      'itr.id AS itr_id',
      'itr.asst_year AS itr_asst_year',
      'itr.status AS itr_status',
      'itr.created_at AS itr_created_at',
      'itr.updated_at AS itr_updated_at',
      'itr.customer_id',
      'itr.Ca_doc1 AS itr_ca_doc1',
      'itr.Ca_doc2 AS itr_ca_doc2',
      'itr.Ca_doc3 AS itr_ca_doc3',
      'itr.Comment',
      'itr.subadmin_send',
      'itr.Subadmin_doc1',
      'itr.Subadmin_doc2'
    ];

    // Essential fields for reports/identification (Always Include)
    selectFields.push('ic.name AS customer_name');
    selectFields.push('ic.pan_number AS customer_pan_number');
    selectFields.push('ic.mobile_no AS customer_mobile');

    // Add other customer fields if permitted
    const customerFieldMap = {
      father_name: 'ic.father_name AS customer_father_name',
      dob: 'ic.dob AS customer_dob',
      adhar_number: 'ic.adhar_number AS customer_adhar_number',
      account_number: 'ic.account_number AS customer_account_number',
      bank_name: 'ic.bank_name AS customer_bank_name',
      ifsc_code: 'ic.ifsc_code AS customer_ifsc_code',
      mail_id: 'ic.mail_id AS customer_email',
      tds_amount: 'ic.tds_amount AS customer_tds_amount',
      itr_passowrd: 'ic.itr_password AS customer_itr_password',
      income_type: 'ic.income_type AS customer_income_type',
      filling_type: 'ic.filling_type AS customer_filling_type',
      last_ay_income: 'ic.last_ay_income AS customer_last_ay_income',
      profile_photo: 'ic.profile_photo AS customer_profile_photo',
      attachments_1: 'ic.attachments_1 AS customer_attachment_1',
      attachments_2: 'ic.attachments_2 AS customer_attachment_2',
      attachments_3: 'ic.attachments_3 AS customer_attachment_3',
      attachments_4: 'ic.attachments_4 AS customer_attachment_4',
      attachments_5: 'ic.attachments_5 AS customer_attachment_5',
      comment_box: 'ic.comment_box AS customer_comment_box',
    };

    if (permissions) {
      for (const [permField, sqlField] of Object.entries(customerFieldMap)) {
        if (permissions[permField] === 1) {
          selectFields.push(sqlField);
        }
      }
    }

    const selectClause = selectFields.join(', ');

    const query = `
      SELECT ${selectClause}
      FROM ca_itr
      JOIN itr ON ca_itr.itr_id = itr.id
      LEFT JOIN itr_customer ic ON itr.id = ic.itr_id
      WHERE ca_itr.ca_id = ?
    `;

    const [rows] = await pool.query(query, [caId]);
    console.log('Fetching assigned ITRs for CA ID:', rows);
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
  const { itr_id, subadmin_id, agent_id, ca_id } = req.body;
  if (!itr_id || !subadmin_id || !agent_id || !ca_id) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    // Check if already assigned
    const [existing] = await pool.query('SELECT * FROM ca_itr WHERE itr_id = ?', [itr_id]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'CA already assigned for this ITR' });
    }
    await pool.query(
      'INSERT INTO ca_itr (itr_id, subadmin_id, agent_id, ca_id) VALUES (?, ?, ?, ?)',
      [itr_id, subadmin_id, agent_id, ca_id]
    );
    res.json({ message: 'CA assigned successfully' });
  } catch (error) {
    console.error('Error assigning CA:', error);
    res.status(500).json({ message: 'Failed to assign CA' });
  }
});

// Get assigned CA for an ITR
router.get('/assigned/:itr_id', async (req, res) => {
  const { itr_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT ca.id, ca.name, ca.email, ca.mobile_no FROM ca_itr
       JOIN ca ON ca_itr.ca_id = ca.id
       WHERE ca_itr.itr_id = ?`,
      [itr_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No CA assigned for this ITR' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching assigned CA:', error);
    res.status(500).json({ message: 'Failed to fetch assigned CA' });
  }
});

// Reject an ITR application
router.post('/reject-itr', authenticateCA, async (req, res) => {
  const { itr_id, reason, extra_charge } = req.body;
  const caId = req.caId;

  if (!itr_id || !reason) {
    return res.status(400).json({ message: 'ITR ID and reason are required' });
  }

  try {
    // Check if the CA is assigned to this ITR
    const [assignment] = await pool.query(
      'SELECT * FROM ca_itr WHERE ca_id = ? AND itr_id = ?',
      [caId, itr_id]
    );

    if (assignment.length === 0) {
      return res.status(403).json({ message: 'You are not assigned to this ITR' });
    }

    // Update the ITR status to 'Rejected', add the comment and extra_charge
    await pool.query(
      'UPDATE itr SET status = ?, Comment = ?, extra_charge = ? WHERE id = ?',
      ['Rejected', reason, extra_charge || null, itr_id]
    );

    await pool.query('UPDATE ca_itr SET status = ? WHERE itr_id = ?', ['Rejected', itr_id]);

    // 3. Log rejection in history
    await pool.query(
      'INSERT INTO itr_rejection_history (itr_id, rejected_by_type, rejected_by_id, reason, extra_charge) VALUES (?, "ca", ?, ?, ?)',
      [itr_id, caId, reason, extra_charge || null]
    );

    res.json({ message: 'ITR rejected successfully' });
  } catch (error) {
    console.error('Error rejecting ITR:', error);
    res.status(500).json({ message: 'Failed to reject ITR' });
  }
});

router.get('/rejected-itrs', authenticateCA, async (req, res) => {
  const caId = req.caId;
  try {
    const [rows] = await pool.query(`
      SELECT rh.*, ic.name, ic.pan_number, i.asst_year
      FROM itr_rejection_history rh
      JOIN itr i ON rh.itr_id = i.id
      JOIN itr_customer ic ON i.id = ic.itr_id
      WHERE rh.rejected_by_type = "ca" AND rh.rejected_by_id = ?
      ORDER BY rh.created_at DESC
    `, [caId]);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching rejected ITRs:', error);
    res.status(500).json({ message: 'Failed to fetch rejected ITRs' });
  }
})

export default router;
