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
    ticket_code: {
      type: String,
      unique: true,
      required: true,
    },
    
    // ===== NEW: Store registration type & team info on ticket =====
    registration_type: {
      type: String,
      enum: ['individual', 'team'],
      required: true,
      description: 'Type of registration: individual or team',
    },
    team_size: {
      type: Number,
      default: 1,
      description: 'Total number of participants (1 for individual, >1 for team)',
    },
    shirt_sizes: {
      type: Map,
      of: Number,
      default: new Map(),
      description: 'Shirt size distribution for team registrations',
    },
    
    check_in_status: {
      type: Boolean,
      default: false,
    },
    check_in_date: {
      type: Date,
      description: 'Date/time when ticket was checked in',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ticket', ticketSchema);
