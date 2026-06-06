const express = require('express');
const {
  processPayment,
  getPaymentByRegistration,
  getPaymentHistory,
} = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Protected routes
router.post('/', authMiddleware, processPayment);
router.get('/registration/:registration_id', authMiddleware, getPaymentByRegistration);
router.get('/history/all', authMiddleware, getPaymentHistory);

module.exports = router;
