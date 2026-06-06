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
    category: {
      type: String,
      required: true,
    },
    shirt_size: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      required: true,
    },
    emergency_contact: {
      type: String,
      required: [true, 'Please provide emergency contact'],
    },
    team_name: {
      type: String,
      default: null,
    },
    registration_status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate registrations
registrationSchema.index({ user_id: 1, event_id: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
