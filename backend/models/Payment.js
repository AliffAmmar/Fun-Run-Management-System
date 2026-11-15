const mongoose = require('mongoose');

// One document per payment ATTEMPT. An order can have several (e.g. a failed card, then a
// successful retry), so nothing here is unique per order.
const paymentSchema = new mongoose.Schema(
  {
    // New registrations (Order + Participant).
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    // Old registrations only. Kept (optional, NOT unique) until reports move to orders.
    registration_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
    },
    // Always copied from order.total_amount on the server, never from the client.
    amount: {
      type: Number,
      required: [true, 'Please provide payment amount'],
    },
    payment_method: {
      type: String,
      enum: ['credit_card', 'debit_card', 'online_banking', 'wallet'],
      default: 'credit_card',
    },
    payment_status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
    },
    provider: {
      type: String,
      enum: ['mock', 'stripe'],
      default: 'mock',
    },
    provider_ref: String, // e.g. Stripe Checkout Session id
    transaction_date: {
      type: Date,
      default: Date.now,
    },
    transaction_id: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
