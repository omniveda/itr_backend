import express from 'express';
const router = express.Router();
import { pool } from '../db.js';

// Middleware to verify JWT token for superadmin
const authenticateSuperadmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.issuperadmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    req.superadmin = { id: decoded.id };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Send message
router.post('/send', authenticateSuperadmin, async (req, res) => {
  try {
    const { recipient_id, recipient_type, message } = req.body;
    const sender_id = req.superadmin.id;

    // Validate recipient exists
    let recipientExists = false;
    if (recipient_type === 'subadmin') {
      const [subadminRows] = await pool.query('SELECT id FROM subadmin WHERE id = ?', [recipient_id]);
      recipientExists = subadminRows.length > 0;
    } else if (recipient_type === 'agent') {
      const [agentRows] = await pool.query('SELECT id FROM agent WHERE id = ?', [recipient_id]);
      recipientExists = agentRows.length > 0;
    } else if (recipient_type === 'ca') {
      const [caRows] = await pool.query('SELECT id FROM ca WHERE id = ?', [recipient_id]);
      recipientExists = caRows.length > 0;
    }

    if (!recipientExists) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const [result] = await pool.query(
      'INSERT INTO messages (sender_id, recipient_id, recipient_type, message) VALUES (?, ?, ?, ?)',
      [sender_id, recipient_id, recipient_type, message]
    );

    res.status(201).json({ message: 'Message sent successfully', data: { id: result.insertId } });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages for superadmin (sent messages)
router.get('/sent', authenticateSuperadmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.*, s.username as recipient_subadmin_username, a.name as recipient_agent_name, c.name as recipient_ca_name
      FROM messages m
      LEFT JOIN subadmin s ON m.recipient_type = 'subadmin' AND m.recipient_id = s.id
      LEFT JOIN agent a ON m.recipient_type = 'agent' AND m.recipient_id = a.id
      LEFT JOIN ca c ON m.recipient_type = 'ca' AND m.recipient_id = c.id
      WHERE m.sender_id = ?
      ORDER BY m.created_at DESC
    `, [req.superadmin.id]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching sent messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get unread messages for recipient (subadmin, agent, ca)
router.get('/unread/:recipient_type/:recipient_id', async (req, res) => {
  try {
    const { recipient_type, recipient_id } = req.params;

    const [rows] = await pool.query(`
      SELECT m.*, sa.username as sender_username
      FROM messages m
      JOIN superadmin sa ON m.sender_id = sa.id
      WHERE m.recipient_id = ? AND m.recipient_type = ?
      ORDER BY m.created_at DESC
    `, [recipient_id, recipient_type]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching unread messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark message as read and delete
router.delete('/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const [result] = await pool.query('DELETE FROM messages WHERE id = ?', [messageId]);

    if (result.affectedRows > 0) {
      res.json({ message: 'Message marked as read and deleted' });
    } else {
      res.status(404).json({ error: 'Message not found' });
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get all recipients for message sending
router.get('/recipients', authenticateSuperadmin, async (req, res) => {
  try {
    const [subadminRows] = await pool.query('SELECT id, username FROM subadmin');
    const [agentRows] = await pool.query('SELECT id, name FROM agent');
    const [caRows] = await pool.query('SELECT id, name FROM ca');

    res.json({
      subadmins: subadminRows.map(s => ({ id: s.id, name: s.username, type: 'subadmin' })),
      agents: agentRows.map(a => ({ id: a.id, name: a.name, type: 'agent' })),
      cas: caRows.map(c => ({ id: c.id, name: c.name, type: 'ca' }))
    });
  } catch (error) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

export default router;
