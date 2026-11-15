const mongoose = require('mongoose');

// Optional organizer-uploaded certificate background (A4 landscape PNG/JPEG), one per event.
// Kept out of the Event document so event lists stay small.
const certificateBackgroundSchema = new mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
    content_type: { type: String, enum: ['image/png', 'image/jpeg'], required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CertificateBackground', certificateBackgroundSchema);
