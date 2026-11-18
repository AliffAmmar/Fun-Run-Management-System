const mongoose = require('mongoose');

// Audit trail for kit collection and event-day check-in (one entry per action, never edited).
// Note (Gate 1 access model): staff share the organizer's login, so `by` is the organizer
// account, not the individual helper.
const checkinLogSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    action: {
      type: String,
      enum: ['kit_collected', 'checked_in', 'undo_kit_collected', 'undo_checked_in', 'kit_remark', 'checkin_remark'],
      required: true,
    },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Which runners this action covered (empty for a remark-only entry).
    participant_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Participant' }],
    count: { type: Number, default: 0 },
    reason: { type: String, trim: true }, // required for undo actions (checked in the controller)
    remark: { type: String, trim: true }, // optional staff note, e.g. why not everyone collected
  },
  { timestamps: { createdAt: 'at', updatedAt: false } }
);

checkinLogSchema.index({ order_id: 1, at: -1 });

module.exports = mongoose.model('CheckinLog', checkinLogSchema);
