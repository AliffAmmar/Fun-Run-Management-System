const express = require('express');
const {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById,
  getAllEvents,
  getOrganizerEvents,
  publishEvent,
} = require('../controllers/eventController');
const { authMiddleware, optionalAuthMiddleware, requireRole } = require('../middleware/auth');

// Creating and managing events: organizers (and admins) only. Before, any logged-in user could
// create an event through the API; the role was only enforced by hiding buttons.
const organizerOnly = [authMiddleware, requireRole('organizer', 'admin')];

const router = express.Router();

// Public routes
router.get('/', getAllEvents);
router.get('/:id', optionalAuthMiddleware, getEventById); // drafts only for their organizer/admin

// Protected routes - organizers can create, update, delete their own events
router.post('/', organizerOnly, createEvent);
router.put('/:id', organizerOnly, updateEvent);
router.delete('/:id', organizerOnly, deleteEvent);
router.post('/:id/publish', organizerOnly, publishEvent);
router.get('/organizer/my-events', organizerOnly, getOrganizerEvents);

module.exports = router;
