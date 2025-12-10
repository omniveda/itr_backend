import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDb, pool } from './db.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import customerRoutes from './routes/customer.js';
import itrRoutes from './routes/itr.js';
import subadminRoutes from './routes/subadmin.js';
import caRoutes from './routes/ca.js';
import assignedItrsRouter from './routes/assignedItrs.js';
import paymentRoutes from './routes/payment.js';
import superadminRoutes from './routes/superadmin.js';
import messageRoutes from './routes/messages.js';
// import agentRoutes from './routes/agent.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Example route to test DB connection
app.get('/agents', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM agent');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Database query error' });
  }
});

// Use auth routes
app.use('/auth', authRoutes);

// Use upload routes
app.use('/upload', uploadRoutes);

// Use customer routes
app.use('/customer', customerRoutes);

app.use('/itr', itrRoutes);
app.use('/subadmin', subadminRoutes);
app.use('/ca', caRoutes);
app.use('/api/assigned-itrs', assignedItrsRouter);
app.use('/payment', paymentRoutes);
app.use('/superadmin', superadminRoutes);
app.use('/messages', messageRoutes);
// app.use('/agent', agentRoutes);

// Serve static files from backend/uploads directory
app.use('/backend/uploads', express.static(path.join(process.cwd(), 'backend', 'uploads')));

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database connection:', err);
});
