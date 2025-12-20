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

router.post('/ca-assessment', upload.array('files', 3), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  const { customer_id, ca_id } = req.body;
  if (!customer_id || !ca_id) {
    return res.status(400).json({ message: 'Missing customer_id or ca_id' });
  }

  try {
    const fileUrls = [];

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Process each uploaded file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileName = `ca_assessment_${customer_id}_${i + 1}_${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);

      // Write file to local system
      fs.writeFileSync(filePath, file.buffer);

      // Create URL for accessing the file
      const fileUrl = `http://localhost:3000/backend/uploads/${fileName}`;
      fileUrls.push(fileUrl);
    }

    // Fetch the itr_id for this customer
    const [itrRows] = await pool.query('SELECT id FROM itr WHERE customer_id = ? ORDER BY id DESC LIMIT 1', [customer_id]);
    if (itrRows.length === 0) {
      return res.status(404).json({ message: 'ITR not found for this customer' });
    }
    const itr_id = itrRows[0].id;

    // Update the itr table with the three CA doc URLs and status
    await pool.query('UPDATE itr SET Ca_doc1 = ?, Ca_doc2 = ?, Ca_doc3 = ?, status = ?, superadmin_send = ? WHERE id = ?', [
      fileUrls[0] || null,
      fileUrls[1] || null,
      fileUrls[2] || null,
      'E-verification',
      1,
      itr_id
    ]);

    // Update the ca_itr table status
    await pool.query('UPDATE ca_itr SET status = ? WHERE itr_id = ?', ['E-verification', itr_id]);

    res.json({ message: 'Assessments uploaded successfully', urls: fileUrls });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
});

export default router;
