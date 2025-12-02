import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { pool } from '../db.js';
import streamifier from 'streamifier';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config for file uploads (memory storage for Cloudinary upload)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload route to Cloudinary
router.post('/image', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  let stream = cloudinary.uploader.upload_stream(
    { folder: 'agent_profiles' },
    (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({ message: 'Image upload failed' });
      }
      res.json({ url: result.secure_url });
    }
  );

  streamifier.createReadStream(req.file.buffer).pipe(stream);
});

router.post('/ca-assessment', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const { customer_id, ca_id } = req.body;
  if (!customer_id || !ca_id) {
    return res.status(400).json({ message: 'Missing customer_id or ca_id' });
  }

  try {
    // Create unique filename
    const fileName = `ca_assessment_${customer_id}_${Date.now()}.pdf`;
    const filePath = path.join(process.cwd(), 'backend', 'uploads', fileName);

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Write file to local system
    fs.writeFileSync(filePath, req.file.buffer);

    // Create URL for accessing the file
    const fileUrl = `http://localhost:3000/backend/uploads/${fileName}`;

    // Update the itr table with ca_upload URL and status
    await pool.query('UPDATE itr SET ca_upload = ?, status = ?, superadmin_send = ? WHERE customer_id = ?', [fileUrl, 'In Progress',1, customer_id]);

    res.json({ message: 'Assessment uploaded successfully', url: fileUrl });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
});

export default router;
