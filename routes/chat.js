
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Create a chat room (subadmin only)
router.post('/rooms', authenticateToken, async (req, res) => {
  const { name, subadmin_id } = req.body;
  const user = req.user;
  if (!name) return res.status(400).json({ message: 'Room name is required' });
  if (!user.issubadmin && !user.issuperadmin) return res.status(403).json({ message: 'Access denied' });
  try {
    const created_by = user.id;
    const subadminId = user.issubadmin ? user.id : subadmin_id || null;
    const [result] = await pool.query(
      'INSERT INTO chat_rooms (name, subadmin_id, created_by, is_active) VALUES (?, ?, ?, 1)',
      [name, subadminId, created_by]
    );
    res.status(201).json({ message: 'Room created', roomId: result.insertId });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove member from room
router.delete('/rooms/:roomId/members/:memberId', authenticateToken, async (req, res) => {
  const user = req.user;
  const { roomId, memberId } = req.params;
  if (!user.issubadmin && !user.issuperadmin) return res.status(403).json({ message: 'Access denied' });
  try {
    const [result] = await pool.query('DELETE FROM chat_room_members WHERE room_id = ? AND id = ?', [roomId, memberId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Member not found in this room' });
    }
    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat rooms (superadmin all, subadmin own, agent/ca rooms they are a member of)
router.get('/rooms', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    if (user.issuperadmin) {
      const [rows] = await pool.query('SELECT * FROM chat_rooms');
      return res.json(rows);
    }
    if (user.issubadmin) {
      const [rows] = await pool.query('SELECT * FROM chat_rooms WHERE subadmin_id = ?', [user.id]);
      return res.json(rows);
    }
    // agent or ca - return rooms where they are member
    const [rows] = await pool.query(
      `SELECT DISTINCT cr.* FROM chat_rooms cr JOIN chat_room_members m ON cr.id = m.room_id WHERE m.user_id = ? AND cr.is_active = 1`,
      [user.id]
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Disable/enable a room (subadmin or superadmin)
router.put('/rooms/:id/disable', authenticateToken, async (req, res) => {
  const user = req.user;
  const roomId = req.params.id;
  const { is_active } = req.body; // boolean
  if (!user.issubadmin && !user.issuperadmin) return res.status(403).json({ message: 'Access denied' });
  try {
    await pool.query('UPDATE chat_rooms SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, roomId]);
    res.json({ message: 'Room updated' });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a room (subadmin/superadmin) - physical delete
router.delete('/rooms/:id', authenticateToken, async (req, res) => {
  const user = req.user;
  const roomId = req.params.id;
  if (!user.issubadmin && !user.issuperadmin) return res.status(403).json({ message: 'Access denied' });
  try {
    await pool.query('DELETE FROM chat_rooms WHERE id = ?', [roomId]);
    res.json({ message: 'Room deleted' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add member to room
router.post('/rooms/:id/members', authenticateToken, async (req, res) => {
  const user = req.user;
  const roomId = req.params.id;
  const { user_id, user_role, display_name } = req.body;
  if (!user.issubadmin && !user.issuperadmin) return res.status(403).json({ message: 'Access denied' });
  try {
    const [result] = await pool.query(
      'INSERT INTO chat_room_members (room_id, user_id, user_role, display_name) VALUES (?, ?, ?, ?)',
      [roomId, user_id, user_role, display_name]
    );
    res.status(201).json({ message: 'Member added', id: result.insertId });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get members of a room
router.get('/rooms/:id/members', authenticateToken, async (req, res) => {
  const roomId = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM chat_room_members WHERE room_id = ?', [roomId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a room
router.get('/rooms/:id/messages', authenticateToken, async (req, res) => {
  const roomId = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY timestamp ASC', [roomId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message to a room
router.post('/rooms/:id/messages', authenticateToken, async (req, res) => {
  const roomId = req.params.id;
  const { message } = req.body;
  const user = req.user;
  if (!message) return res.status(400).json({ message: 'Message text is required' });
  try {
    const [result] = await pool.query('INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)', [roomId, user.id, message]);
    const messageId = result.insertId;
    // emit via socket if present
    const io = req.app.get('io');
    if (io) {
      io.to(`room_${roomId}`).emit('room_message', {
        id: messageId,
        room_id: Number(roomId),
        sender_id: user.id,
        message,
        timestamp: new Date().toISOString(),
      });
    }
    res.status(201).json({ message: 'Message sent', id: messageId });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
