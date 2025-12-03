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

// // // Get agent permissions
// router.get('/permissions', requireAgent, async (req, res) => {
//   try {
//     const agentId = req.user.id;
//     console.log("This is from agent permissions",agentId);
//     const [permissions] = await pool.query('SELECT permissions FROM agent_permissions WHERE agent_id = ?', [agentId]);
//     res.json(permissions.length > 0 ? JSON.parse(permissions[0].permissions) : []);
//   } catch (error) {
//     console.error('Error fetching agent permissions:', error);
//     res.status(500).json({ error: 'Failed to fetch agent permissions' });
//   }
// });


router.get("/pan-number/:id",requireAgent,async(req,res)=>{
    const agentId=req.params;
    try{
        const [customer] = await pool.query('SELECT pan_number FROM customer WHERE agent_id = ?',[agentId]);
        res.json(customer);
    }
})


export default router;
