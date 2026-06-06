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
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getAllEvents);
router.get('/:id', getEventById);

// Protected routes - organizers can create, update, delete their own events
router.post('/', authMiddleware, createEvent);
router.put('/:id', authMiddleware, updateEvent);
router.delete('/:id', authMiddleware, deleteEvent);
router.post('/:id/publish', authMiddleware, publishEvent);
router.get('/organizer/my-events', authMiddleware, getOrganizerEvents);

module.exports = router;
