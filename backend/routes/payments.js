const express = require('express');
const {
  getPaymentConfig,
  mockPayOrder,
  processPayment,
  getPaymentByRegistration,
  getPaymentHistory,
} = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Orders (new registration flow)
router.get('/config', getPaymentConfig);
router.post('/orders/:order_no/mock', authMiddleware, mockPayOrder);

// Old registration flow (to be removed with Registration/Ticket)
router.post('/', authMiddleware, processPayment);
router.get('/registration/:registration_id', authMiddleware, getPaymentByRegistration);
router.get('/history/all', authMiddleware, getPaymentHistory);

module.exports = router;
