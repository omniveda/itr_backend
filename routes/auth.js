import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { subadmin, ca, username, password, ...agentData } = req.body;

  if (subadmin) {
    // Register subadmin
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required for subadmin' });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        'INSERT INTO subadmin (username, password) VALUES (?, ?)',
        [username, hashedPassword]
      );
      res.status(201).json({ message: 'Subadmin registered successfully', subadminId: result.insertId });
    } catch (error) {
      console.error('Error registering subadmin:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  } else {
    // Register agent
    let { name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, password } = agentData;
    if (!name || !mobile_no || !password) {
      return res.status(400).json({ message: 'Name, mobile number, and password are required' });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      if (typeof profile_photo === 'object' && profile_photo.url) {
        profile_photo = profile_photo.url;
      }
      const [result] = await pool.query(
        'INSERT INTO agent (name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, password, isagent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, hashedPassword, 'unverified']
      );
      res.status(201).json({ message: 'Agent registered successfully', agentId: result.insertId });
    } catch (error) {
      console.error('Error registering agent:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  }
});

router.post('/login', async (req, res) => {
  const { email, password, subadmin, ca } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Mobile number/username and password are required' });
  }

  try {
    if (ca) {
      // CA login
      console.log('Attempting CA login with username:', email); // Add logging
      const [rows] = await pool.query('SELECT * FROM ca WHERE username = ?', [email]);
      console.log('CA query results:', rows.length ? 'Found' : 'Not found'); // Add logging
      if (rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const caUser = rows[0];
      console.log('Found CA user:', { id: caUser.id, username: caUser.username, name: caUser.name }); // Add logging
      const isValidPassword = await bcrypt.compare(password, caUser.password);
      console.log('Password validation:', isValidPassword ? 'Success' : 'Failed'); // Add logging
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const token = jwt.sign({ id: caUser.id, username: caUser.username, isCA: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({
        token,
        ca: {
          id: caUser.id,
          username: caUser.username,
          name: caUser.name,
          email: caUser.email,
          isCA: true
        }
      });
    } else if (subadmin) {
      // Subadmin login
      const [rows] = await pool.query('SELECT * FROM subadmin WHERE username = ?', [email]);
      if (rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const subadminUser = rows[0];
      const isValidPassword = await bcrypt.compare(password, subadminUser.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const token = jwt.sign({ id: subadminUser.id, username: subadminUser.username, issubadmin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({
        token,
        subadmin: {
          id: subadminUser.id,
          username: subadminUser.username,
          issubadmin: subadminUser.issubadmin
        }
      });
    } else {
      // Agent login
      const [rows] = await pool.query('SELECT * FROM agent WHERE mobile_no = ?', [email]);
      if (rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const agent = rows[0];
      const isValidPassword = await bcrypt.compare(password, agent.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: agent.id, mobile_no: agent.mobile_no }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({
        token,
        agent: {
          id: agent.id,
          name: agent.name,
          father_name: agent.father_name,
          mobile_no: agent.mobile_no,
          mail_id: agent.mail_id,
          address: agent.address,
          profile_photo: agent.profile_photo,
          alternate_mobile_no: agent.alternate_mobile_no,
          wbalance: agent.wbalance,
          isagent: agent.isagent
        }
      });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-auth-token'];
  console.log('Token received:', token ? 'present' : 'missing');
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    if (decoded.isCA) {
      const [rows] = await pool.query('SELECT id, username, name, email FROM ca WHERE id = ?', [decoded.id]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'CA not found' });
      }
      res.json({ ca: rows[0] });
    } else if (decoded.issubadmin) {
      const [rows] = await pool.query('SELECT id, username, issubadmin FROM subadmin WHERE id = ?', [decoded.id]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Subadmin not found' });
      }
      res.json({ subadmin: rows[0] });
    } else {
      const [rows] = await pool.query('SELECT id, name, father_name, mobile_no, mail_id, address, profile_photo, alternate_mobile_no, wbalance, isagent FROM agent WHERE id = ?', [decoded.id]);
      console.log('Agent query result:', rows.length, 'rows found');
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Agent not found' });
      }
      res.json({ agent: rows[0] });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
