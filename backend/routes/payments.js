const express = require('express');
const {
  getPaymentConfig,
  mockPayOrder,
} = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/config', getPaymentConfig);
router.post('/orders/:order_no/mock', authMiddleware, mockPayOrder);

module.exports = router;
