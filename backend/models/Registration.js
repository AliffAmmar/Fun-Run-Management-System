const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },

    registration_type: {
      type: String,
      enum: ['individual', 'team'],
      required: true,
      description: 'Registration type: individual or team',
    },

    // ===== For individual registrations - CONDITIONAL REQUIRED =====
    race_category: {
      type: String,
      required: function() {
        return this.registration_type === 'individual';
      },
      description: 'The race category selected (5K, 10K, etc.)',
    },
    shirt_size: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      required: function() {
        return this.registration_type === 'individual';
      },
      description: 'Single shirt size for individual registration',
    },
    emergency_contact: {
      type: String,
      required: function() {
        return this.registration_type === 'individual';
      },
      description: 'Emergency contact number for individual registration',
    },

    // ===== For team registrations =====
    team_name: {
      type: String,
      required: function() {
        return this.registration_type === 'team';
      },
      description: 'Team name for bulk registration',
    },
    team_size: {
      type: Number,
      default: 1,
      description: 'Total number of participants in the team',
    },
    shirt_sizes: {
      type: Map,
      of: Number,
      default: new Map(),
      description: 'Size distribution for team: { "XS": 5, "S": 10, "M": 8, "L": 7, "XL": 0, "XXL": 0 }',
    },

    // ===== Common fields =====
    total_amount: {
      type: Number,
      required: true,
      description: 'Total registration cost (event_price * team_size for teams, event_price for individuals)',
    },
    registration_status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index to allow multiple team registrations per user for same event
// But prevent duplicate individual registrations
registrationSchema.index(
  { user_id: 1, event_id: 1, registration_type: 1 },
  {
    unique: true,
    partialFilterExpression: { registration_type: 'individual' },
  }
);

// Index for faster queries by event
registrationSchema.index({ event_id: 1 });

// Index for faster queries by user
registrationSchema.index({ user_id: 1 });

module.exports = mongoose.model('Registration', registrationSchema);