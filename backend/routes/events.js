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
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getAllEvents);
router.get('/:id', getEventById);

// Protected routes
router.post('/', authMiddleware, adminMiddleware, createEvent);
router.put('/:id', authMiddleware, adminMiddleware, updateEvent);
router.delete('/:id', authMiddleware, adminMiddleware, deleteEvent);
router.post('/:id/publish', authMiddleware, adminMiddleware, publishEvent);
router.get('/organizer/my-events', authMiddleware, getOrganizerEvents);

module.exports = router;
