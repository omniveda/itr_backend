import express from 'express';
import { pool } from '../db.js';
import jwt from 'jsonwebtoken';

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

// Get all ratecards/penalties
router.get('/', requireSuperadmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM ratecard ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching ratecards:', error);
        res.status(500).json({ error: 'Failed to fetch ratecards' });
    }
});

// Create a new ratecard/penalty
router.post('/', requireSuperadmin, async (req, res) => {
    const { income_slab, assessment_year, calendar_from, calendar_to, penalty_amount } = req.body;

    if (!income_slab || !assessment_year || !calendar_from || !calendar_to || !penalty_amount) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO ratecard (income_slab, assessment_year, calendar_from, calendar_to, penalty_amount) VALUES (?, ?, ?, ?, ?)',
            [income_slab, assessment_year, calendar_from, calendar_to, penalty_amount]
        );
        res.status(201).json({ message: 'Ratecard created successfully', id: result.insertId });
    } catch (error) {
        console.error('Error creating ratecard:', error);
        res.status(500).json({ error: 'Failed to create ratecard' });
    }
});

// Update a ratecard/penalty
router.put('/:id', requireSuperadmin, async (req, res) => {
    const { id } = req.params;
    const { income_slab, assessment_year, calendar_from, calendar_to, penalty_amount } = req.body;

    try {
        const [result] = await pool.query(
            'UPDATE ratecard SET income_slab = ?, assessment_year = ?, calendar_from = ?, calendar_to = ?, penalty_amount = ? WHERE id = ?',
            [income_slab, assessment_year, calendar_from, calendar_to, penalty_amount, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ratecard not found' });
        }

        res.json({ message: 'Ratecard updated successfully' });
    } catch (error) {
        console.error('Error updating ratecard:', error);
        res.status(500).json({ error: 'Failed to update ratecard' });
    }
});

// Delete a ratecard/penalty
router.delete('/:id', requireSuperadmin, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM ratecard WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ratecard not found' });
        }

        res.json({ message: 'Ratecard deleted successfully' });
    } catch (error) {
        console.error('Error deleting ratecard:', error);
        res.status(500).json({ error: 'Failed to delete ratecard' });
    }
});

// Check penalty for given slab and AY
router.post('/check-penalty', async (req, res) => {
    const { income_slab, assessment_year } = req.body;

    if (!income_slab || !assessment_year) {
        return res.status(400).json({ error: 'Income slab and Assessment Year are required' });
    }

    try {
        const query = `
            SELECT penalty_amount 
            FROM ratecard 
            WHERE income_slab = ? 
            AND assessment_year = ? 
            AND CURDATE() BETWEEN calendar_from AND calendar_to
            LIMIT 1
        `;

        const [rows] = await pool.query(query, [income_slab, assessment_year]);

        if (rows.length > 0) {
            res.json({ penalty_amount: parseFloat(rows[0].penalty_amount) });
        } else {
            res.json({ penalty_amount: 0 });
        }
    } catch (error) {
        console.error('Error checking penalty:', error);
        res.status(500).json({ error: 'Failed to check penalty' });
    }
});

export default router;
