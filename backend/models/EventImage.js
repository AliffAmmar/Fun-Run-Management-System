const mongoose = require('mongoose');

// Pictures for an event: one optional `cover` (banner / list card) and any number of `info`
// pictures with a caption (kit photo, size chart, poster, route map…).
// Stored here, not on Event, so event lists stay small. Served by GET /api/events/:id/images/:imageId.
const eventImageSchema = new mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    kind: { type: String, enum: ['cover', 'info'], required: true },
    caption: { type: String, trim: true, maxlength: 120 },
    content_type: { type: String, enum: ['image/png', 'image/jpeg', 'image/webp'], required: true },
    data: { type: Buffer, required: true },
    size: Number,
  },
  { timestamps: true }
);

eventImageSchema.index({ event_id: 1, kind: 1, createdAt: 1 });

module.exports = mongoose.model('EventImage', eventImageSchema);
