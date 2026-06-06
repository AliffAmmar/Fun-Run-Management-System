const express = require('express');
const {
  registerForEvent,
  getRegistrationsByUser,
  getRegistrationsByEvent,
  getRegistrationById,
  cancelRegistration,
} = require('../controllers/registrationController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Protected routes
router.post('/', authMiddleware, registerForEvent);
router.get('/my-registrations', authMiddleware, getRegistrationsByUser);
router.get('/:id', authMiddleware, getRegistrationById);
router.delete('/:id', authMiddleware, cancelRegistration);

// Admin/Organizer routes
router.get('/event/:event_id/registrations', authMiddleware, adminMiddleware, getRegistrationsByEvent);

module.exports = router;
