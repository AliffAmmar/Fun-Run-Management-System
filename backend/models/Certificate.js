const mongoose = require('mongoose');

// One certificate per eligible participant. The PDF is never stored: it is generated from this
// record + the participant + the event whenever it is emailed or downloaded.
const certificateSchema = new mongoose.Schema(
  {
    participant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: true,
      unique: true, // completing an event twice can never create duplicates
    },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    // Public code printed on the certificate and used by /verify/:certificate_no, e.g. FR-C-7K3M9Q2X.
    certificate_no: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'skipped_no_email'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    sent_at: Date,
    error: String,
  },
  { timestamps: true }
);

certificateSchema.index({ event_id: 1, status: 1 });
certificateSchema.index({ order_id: 1 });

module.exports = mongoose.model('Certificate', certificateSchema);
