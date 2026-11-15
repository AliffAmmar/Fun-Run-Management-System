const Payment = require('../models/Payment');
const crypto = require('crypto');
const Order = require('../models/Order');
const { fulfilOrder } = require('../utils/orderFulfilment');

const PAYMENT_METHODS = ['credit_card', 'debit_card', 'online_banking', 'wallet'];
const paymentMode = () => (process.env.PAYMENT_MODE || 'mock').toLowerCase();

// GET /api/payments/config: lets the frontend know which payment flow to show.
const getPaymentConfig = (req, res) => {
  res.json({ mode: paymentMode() });
};

// POST /api/payments/orders/:order_no/mock   body: { payment_method?, simulate?: 'fail' }
// Demo payment (PAYMENT_MODE=mock). The amount always comes from the order, never the client.
// `simulate: 'fail'` records a failed attempt so retries can be demonstrated.
const mockPayOrder = async (req, res) => {
  try {
    if (paymentMode() !== 'mock') {
      return res.status(404).json({ message: 'Demo payment is not enabled' });
    }

    const order = await Order.findOne({ order_no: req.params.order_no });
    if (!order) return res.status(404).json({ message: 'Registration not found' });
    if (String(order.user_id) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Only the person who registered can pay for this registration' });
    }
    if (order.status === 'paid') {
      return res.status(400).json({ message: 'This registration is already paid' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'This registration was cancelled' });
    }
    if (!order.holdsSlots()) {
      return res.status(410).json({
        message: 'This registration expired before payment (slots are held for 30 minutes). Please register again.',
      });
    }

    const payment_method = PAYMENT_METHODS.includes(req.body?.payment_method)
      ? req.body.payment_method
      : 'credit_card';
    const failed = req.body?.simulate === 'fail';

    const payment = await Payment.create({
      order_id: order._id,
      amount: order.total_amount,
      payment_method,
      payment_status: failed ? 'failed' : 'success',
      provider: 'mock',
      transaction_id: 'MOCK_' + crypto.randomBytes(6).toString('hex').toUpperCase(),
      transaction_date: new Date(),
    });

    if (failed) {
      return res.status(402).json({ message: 'Payment failed (simulated). You can try again.', payment });
    }

    const result = await fulfilOrder(order._id);
    if (result.error) {
      return res.status(409).json({ message: result.error, payment });
    }

    res.status(201).json({ message: 'Payment successful', payment, order: result.order });
  } catch (error) {
    res.status(500).json({ message: 'Failed to process payment', error: error.message });
  }
};

module.exports = {
  getPaymentConfig,
  mockPayOrder,
};
