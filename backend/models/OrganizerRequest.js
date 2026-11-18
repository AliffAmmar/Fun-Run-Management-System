const mongoose = require('mongoose');

// A participant asking to become an organizer. An admin approves (→ role becomes organizer) or
// rejects (with an optional reason). At most one pending request per user.
const organizerRequestSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: String, required: true, trim: true, maxlength: 100 },
    note: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    decided_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decided_at: Date,
    decision_reason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

organizerRequestSchema.index({ status: 1, createdAt: 1 });
organizerRequestSchema.index(
  { user_id: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } } // one open request per user
);

module.exports = mongoose.model('OrganizerRequest', organizerRequestSchema);
