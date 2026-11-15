const express = require('express');
const {
  generateTicket,
  getTicketByRegistration,
  getUserTickets,
} = require('../controllers/ticketController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Protected routes
router.post('/generate', authMiddleware, generateTicket);
router.get('/registration/:registration_id', authMiddleware, getTicketByRegistration);
router.get('/my-tickets', authMiddleware, getUserTickets);

// Check-in moved to /api/checkin (only that event's organizer). The old POST /checkin let any
// organizer check in any event's ticket.

module.exports = router;
