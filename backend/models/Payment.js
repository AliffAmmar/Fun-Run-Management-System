const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    registration_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
      unique: true,
    },
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
