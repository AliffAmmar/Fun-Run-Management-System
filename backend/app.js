// Express app: middleware + routes only. No database connection and no app.listen() here,
// so tests can import the app (see tests/) without starting a real server.
// server.js connects to MongoDB and starts listening.
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const orderRoutes = require('./routes/orders');
const checkinRoutes = require('./routes/checkin');
const certificateRoutes = require('./routes/certificates');
const adminRoutes = require('./routes/admin');
const organizerRequestRoutes = require('./routes/organizerRequests');
const eventImageRoutes = require('./routes/eventImages');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events/:eventId/images', eventImageRoutes); // before /api/events
app.use('/api/events', eventRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organizer-requests', organizerRequestRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

module.exports = app;
