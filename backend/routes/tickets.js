const express = require('express');
const {
  generateTicket,
  getTicketByRegistration,
  getUserTickets,
  checkInTicket,
} = require('../controllers/ticketController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Protected routes
router.post('/generate', authMiddleware, generateTicket);
router.get('/registration/:registration_id', authMiddleware, getTicketByRegistration);
router.get('/my-tickets', authMiddleware, getUserTickets);

// Admin/Organizer routes
router.post('/checkin', authMiddleware, adminMiddleware, checkInTicket);

module.exports = router;
