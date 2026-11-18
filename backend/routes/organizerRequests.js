const express = require('express');
const { createRequest, getMyRequest, cancelMyRequest } = require('../controllers/organizerRequestController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// The logged-in user's own request (participants ask; checked in the controller).
router.post('/', authMiddleware, createRequest);
router.get('/mine', authMiddleware, getMyRequest);
router.delete('/mine', authMiddleware, cancelMyRequest);

module.exports = router;
