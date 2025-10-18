import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/assigned-itrs
router.get('/', async (req, res) => {
  try {
    // Example query: join itr, customer, agent, ca tables
    const [rows] = await pool.query(`
      SELECT 
        itr.id AS itr_id,
        customer.name AS customer_name,
        customer.pan_number AS customer_pan,
        agent.name AS agent_name
      FROM itr
      LEFT JOIN customer ON itr.customer_id = customer.id
      LEFT JOIN agent ON itr.agent_id = agent.id
      ORDER BY itr.id DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching assigned ITRs:', error);
    res.status(500).json({ message: 'Failed to fetch assigned ITRs' });
  }
});

export default router;
