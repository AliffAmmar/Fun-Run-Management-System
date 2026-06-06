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
          enum: ['5K', '10K', 'Half Marathon', 'Marathon', 'Family Run'],
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
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
