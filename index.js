import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import { initDb, pool } from './db.js';
import jwt from 'jsonwebtoken';
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
import chatRoutes from './routes/chat.js';
import walletRoutes from './routes/wallet.js';
import agentRoutes from './routes/agent.js';
import subadminEverificationRoutes from './routes/subadminEverification.js';
import ratecardRoutes from './routes/ratecard.js';

const app = express();
const PORT = process.env.PORT || 3000;

// create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: 'http://localhost:3001',
    credentials: true,
  },
});

// attach io to app so routes can emit
app.set('io', io);

app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Example route to test DB connection
app.get('/agents', agentRoutes);

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
app.use('/chat', chatRoutes);
app.use('/wallet', walletRoutes);
app.use('/subadmin-everification', subadminEverificationRoutes);
app.use('/ratecard', ratecardRoutes);
// app.use('/agent', agentRoutes);

// Serve static files from backend/uploads directory
app.use('/backend/uploads', express.static(path.join(process.cwd(), 'backend', 'uploads')));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// add middleware for socket auth - optional but recommended
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    // allow non-authenticated sockets (e.g., public) but you can reject
    return next();
  }
  try {
    const cleanToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    socket.user = decoded;
    return next();
  } catch (err) {
    console.warn('Socket auth failed:', err.message);
    return next();
  }
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join_room', ({ roomId }) => {
    const roomName = `room_${roomId}`;
    socket.join(roomName);
    socket.to(roomName).emit('user_joined', { socketId: socket.id, roomId });
  });

  socket.on('leave_room', ({ roomId }) => {
    const roomName = `room_${roomId}`;
    socket.leave(roomName);
    socket.to(roomName).emit('user_left', { socketId: socket.id, roomId });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database connection:', err);
});
