const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    registration_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
      unique: true,
    },
    qr_code: {
      type: String,
      required: true,
    },
    check_in_status: {
      type: Boolean,
      default: false,
    },
    ticket_code: {
      type: String,
      unique: true,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ticket', ticketSchema);
