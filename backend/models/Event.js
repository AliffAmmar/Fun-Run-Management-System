const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    event_name: {
      type: String,
      required: [true, 'Please provide event name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide event description'],
    },
    date: {
      type: Date,
      required: [true, 'Please provide event date'],
    },
    location: {
      type: String,
      required: [true, 'Please provide event location'],
    },
    categories: [
      {
        name: {
          type: String,
          enum: ['1km', '3km', '5km', '10km'],
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    capacity: {
      type: Number,
      required: [true, 'Please provide event capacity'],
    },
    organizer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      // 'completed' = organizer marked the event as finished; certificates are generated then.
      enum: ['draft', 'published', 'closed', 'completed'],
      default: 'draft',
    },
    completed_at: Date,
    // ---- Certificates (see controllers/certificateController.js) ----
    // Who gets a certificate. Undecided with the collaborator, so it's a per-event setting.
    certificate_eligibility: {
      type: String,
      enum: ['all_paid', 'kit_collected', 'checked_in'],
      default: 'all_paid',
    },
    // Text colour on the certificate: dark text for light backgrounds, light for dark ones.
    certificate_text_color: {
      type: String,
      enum: ['dark', 'light'],
      default: 'dark',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
