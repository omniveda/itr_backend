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
        if (!decoded.issubadmin) {
            return res.status(403).json({ message: 'Access denied. Subadmin only.' });
        }
        req.subadminId = decoded.id;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// GET /api/subadmin-everification/list
// Returns ITRs that are in 'E-verification' or 'Filled' status
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT itr.*, customer.*, itr.id as id, customer.id as customer_id, 
                   agent.name as agent_name
            FROM itr
            JOIN customer ON itr.customer_id = customer.id
            JOIN agent ON itr.agent_id = agent.id
            WHERE (itr.status = 'E-verification' OR itr.status = 'Completed' OR itr.status = 'Filled')
            AND itr.subadmin_send = 1
            ORDER BY itr.updated_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching everification list:', error);
        res.status(500).json({ message: 'Failed to fetch list' });
    }
});

// PUT /api/subadmin-everification/otp-check/:itrId
// Complete OTP check and move status to Completed
router.put('/otp-check/:itrId', authenticateToken, upload.single('document'), async (req, res) => {
    const { itrId } = req.params;
    try {
        let updateQuery = 'UPDATE itr SET otp_check=TRUE, status="Completed"';
        let params = [];

        if (req.file) {
            const fileName = `subadmin_otp_doc_${itrId}_${Date.now()}${path.extname(req.file.originalname)}`;
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

        // Update itr_flow with OTP/Completion date
        await pool.query(
            'UPDATE itr_flow SET everification_date = CURRENT_TIMESTAMP, completed_date = CURRENT_TIMESTAMP WHERE itr_id = ? AND completed_date IS NULL',
            [itrId]
        );

        const [result] = await pool.query(updateQuery, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'ITR not found' });
        }
        res.json({ message: 'OTP check completed and ITR status updated to Completed' });
    } catch (error) {
        console.error('Error in subadmin otp-check:', error);
        res.status(500).json({ message: 'Failed to update OTP check status' });
    }
});

export default router;
