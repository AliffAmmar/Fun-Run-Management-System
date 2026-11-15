const mongoose = require('mongoose');

// Atomic sequence numbers. One document per sequence, identified by `key`:
//   'order_no'        → global order number (FR-1001, FR-1002, ...)
//   'bib:<event_id>'  → bib numbers, separate per event
// Always increment with findOneAndUpdate + $inc (see utils/numbering.js), never read-then-write.
const counterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('Counter', counterSchema);
