const express = require('express');
const {
  createOrder,
  getMyOrders,
  getOrderByNo,
  cancelOrder,
  getOrdersByEvent,
} = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes need a logged-in user. Who may see/do what is checked inside each controller
// (buyer / that event's organizer / admin), not by role alone.
router.post('/', authMiddleware, createOrder);
router.get('/my-orders', authMiddleware, getMyOrders);
router.get('/event/:event_id', authMiddleware, getOrdersByEvent);
router.get('/:order_no', authMiddleware, getOrderByNo);
router.delete('/:order_no', authMiddleware, cancelOrder);

module.exports = router;
