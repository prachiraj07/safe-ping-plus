const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const locationRoutes = require('./routes/location');
const emergencyRoutes = require('./routes/emergency');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/emergency', emergencyRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.IO for real-time tracking
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('location-update', (data) => {
    io.to(data.userId).emit('location-changed', data.location);
  });

  socket.on('panic-alert', (data) => {
    // Broadcast to emergency contacts
    data.contacts.forEach(contactId => {
      io.to(contactId).emit('emergency-alert', {
        userId: data.userId,
        location: data.location,
        timestamp: Date.now()
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
console.log('Twilio config:', {
  SID: process.env.TWILIO_ACCOUNT_SID,
  TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'set' : 'not set',
  NUMBER: process.env.TWILIO_PHONE_NUMBER
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for real-time updates`);
});

module.exports = { app, io };
