const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { seedCabs } = require('./controllers/cabController');
const User = require('./models/User');

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@cabgo.in' });
    if (!adminExists) {
      await User.create({
        name: 'System Admin',
        email: 'admin@cabgo.in',
        phone: '9876543210',
        password: 'admin@123',
        role: 'admin',
        isApproved: true,
      });
      console.log('✅ Demo Admin created: admin@cabgo.in / admin@123');
    }
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  }
};

// Connect to MongoDB then seed default cabs & admin
connectDB().then((conn) => {
  if (conn) {
    seedCabs();
    seedAdmin();
  }
});

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS (local dev + production Vercel apps)
const allowedOrigins = process.env.CLIENT_URL 
  ? [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000']
  : '*';

// Setup Socket.IO for real-time Uber/Rapido working
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);

// Socket connection & rooms
io.on('connection', (socket) => {
  // Join role/user rooms
  socket.on('join', ({ userId, role }) => {
    if (userId) {
      socket.join('user_' + userId);
    }
    if (role === 'driver') {
      socket.join('drivers');
    }
  });

  // Driver going online/offline
  socket.on('driver_online', ({ driverId }) => {
    socket.join('drivers');
    socket.join('driver_' + driverId);
  });

  socket.on('driver_offline', ({ driverId }) => {
    socket.leave('drivers');
  });

  // Track specific booking room
  socket.on('join_booking', ({ bookingId }) => {
    if (bookingId) {
      socket.join('booking_' + bookingId);
    }
  });

  // Live driver GPS location updates (broadcast to customer)
  socket.on('driver_location', ({ bookingId, lat, lng, heading }) => {
    if (bookingId) {
      socket.to('booking_' + bookingId).emit('driver_location_update', { lat, lng, heading });
    }
  });

  socket.on('disconnect', () => {
    // Cleaned up by socket.io automatically
  });
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/cabs', require('./routes/cabs'));
app.use('/api/driver', require('./routes/driver'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));

// Health check
app.get('/', (req, res) => {
  res.json({ message: '🚕 CabGo API with Live WebSockets is running!', status: 'OK' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CabGo Server with Socket.IO running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});
