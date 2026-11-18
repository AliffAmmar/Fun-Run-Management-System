const mongoose = require('mongoose');

// One Participant = one runner. Belongs to exactly one Order (order_id is the group link).
// This is what certificates, bib numbers and shirt-size counts are based on.

const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const participantSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    // UI label: "Full name (as it should appear on your certificate)"
    name: {
      type: String,
      required: [true, 'Please provide the participant name'],
      trim: true,
    },
    // Optional for group members. Without it, the member's certificate goes to the buyer.
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    shirt_size: {
      type: String,
      enum: SHIRT_SIZES,
      required: [true, 'Please provide a shirt size'],
    },
    // Shirt cut chosen by the runner ('male' | 'female'), NOT their gender. Required for every new
    // registration (utils/orderValidation.js); not required here only so runners saved before shirt
    // types existed stay valid.
    shirt_type: {
      type: String,
      enum: ['male', 'female'],
    },
    emergency_contact: {
      type: String,
      trim: true, // optional; falls back to the order's emergency_contact
    },
    // Assigned when the order is paid (utils/numbering.js → assignBibNumbers). Stored as a
    // formatted string, e.g. "0042".
    bib_number: String,
    finish_time: Date, // reserved; completion tracking is not built

    // Per-runner kit collection and event-day check-in (ticked on the check-in page).
    // The order's own kit_collected / checked_in become true only when ALL its runners are ticked.
    kit_collected: { type: Boolean, default: false },
    kit_collected_at: Date,
    kit_collected_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checked_in: { type: Boolean, default: false },
    checked_in_at: Date,
    checked_in_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

participantSchema.index({ order_id: 1 });
participantSchema.index({ event_id: 1, email: 1 }); // duplicate-email warning per event

// Bib numbers are unique within an event. A partial index (only participants that HAVE a bib)
// is used instead of `sparse`: a sparse compound index would still index { event_id, null }
// for every unpaid participant and reject the second one.
participantSchema.index(
  { event_id: 1, bib_number: 1 },
  { unique: true, partialFilterExpression: { bib_number: { $type: 'string' } } }
);

participantSchema.statics.SHIRT_SIZES = SHIRT_SIZES;

module.exports = mongoose.model('Participant', participantSchema);
