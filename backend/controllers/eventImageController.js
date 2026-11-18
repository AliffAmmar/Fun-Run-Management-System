// Event pictures (cover + info pictures). Upload/edit/delete: that event's organizer or an admin.
// Viewing: public (they are promotional pictures; ids are unguessable).
const mongoose = require('mongoose');
const Event = require('../models/Event');
const EventImage = require('../models/EventImage');
const { MAX_IMAGE_BYTES, MAX_INFO_IMAGES, TYPES, looksLike, imagePath } = require('../utils/eventImages');

const canManage = (event, user) =>
  user.role === 'admin' || (user.role === 'organizer' && String(event.organizer_id) === String(user.userId));
const cleanCaption = (v) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 120);

async function loadManaged(req, res) {
  if (!mongoose.isValidObjectId(req.params.eventId)) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }
  if (!canManage(event, req.user)) {
    res.status(403).json({ message: 'Only the event organizer can change its pictures' });
    return null;
  }
  return event;
}

// POST /api/events/:eventId/images?kind=cover|info&caption=...   body: raw image bytes
// (Content-Type image/png|jpeg|webp). A new cover replaces the old one.
const uploadImage = async (req, res) => {
  try {
    const event = await loadManaged(req, res);
    if (!event) return;
    const kind = req.query.kind === 'cover' ? 'cover' : req.query.kind === 'info' ? 'info' : null;
    if (!kind) return res.status(400).json({ message: "kind must be 'cover' or 'info'" });

    const type = (req.headers['content-type'] || '').split(';')[0].trim();
    if (!TYPES.includes(type) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: 'Upload a PNG, JPEG or WebP image' });
    }
    if (req.body.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ message: 'Image is larger than 5 MB' });
    }
    if (!looksLike(type, req.body)) {
      return res.status(400).json({ message: 'The file is not a valid PNG, JPEG or WebP image' });
    }
    if (kind === 'info' && (await EventImage.countDocuments({ event_id: event._id, kind: 'info' })) >= MAX_INFO_IMAGES) {
      return res.status(400).json({ message: `At most ${MAX_INFO_IMAGES} info pictures per event` });
    }

    const image = await EventImage.create({
      event_id: event._id,
      kind,
      caption: kind === 'info' ? cleanCaption(req.query.caption) || undefined : undefined,
      content_type: type,
      data: req.body,
      size: req.body.length,
    });
    if (kind === 'cover') {
      await EventImage.deleteMany({ event_id: event._id, kind: 'cover', _id: { $ne: image._id } });
    }
    res.status(201).json({
      message: kind === 'cover' ? 'Cover picture saved' : 'Picture added',
      image: { _id: image._id, kind, caption: image.caption || '', url: imagePath(event._id, image._id) },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload picture', error: error.message });
  }
};

// PATCH /api/events/:eventId/images/:imageId   { caption }
const updateCaption = async (req, res) => {
  try {
    const event = await loadManaged(req, res);
    if (!event) return;
    if (!mongoose.isValidObjectId(req.params.imageId)) return res.status(404).json({ message: 'Picture not found' });
    const image = await EventImage.findOneAndUpdate(
      { _id: req.params.imageId, event_id: event._id, kind: 'info' },
      { caption: cleanCaption(req.body?.caption) || undefined },
      { new: true }
    ).select('caption');
    if (!image) return res.status(404).json({ message: 'Picture not found' });
    res.json({ message: 'Caption saved', caption: image.caption || '' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save caption', error: error.message });
  }
};

// DELETE /api/events/:eventId/images/:imageId
const deleteImage = async (req, res) => {
  try {
    const event = await loadManaged(req, res);
    if (!event) return;
    if (!mongoose.isValidObjectId(req.params.imageId)) return res.status(404).json({ message: 'Picture not found' });
    const r = await EventImage.deleteOne({ _id: req.params.imageId, event_id: event._id });
    if (!r.deletedCount) return res.status(404).json({ message: 'Picture not found' });
    res.json({ message: 'Picture removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove picture', error: error.message });
  }
};

// GET /api/events/:eventId/images/:imageId → the image (public, cached).
const serveImage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.imageId)) return res.status(404).end();
    const image = await EventImage.findOne({ _id: req.params.imageId, event_id: req.params.eventId });
    if (!image) return res.status(404).end();
    res.set({
      'Content-Type': image.content_type,
      'Cache-Control': 'public, max-age=31536000, immutable', // a replaced picture gets a new id
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(image.data);
  } catch (error) {
    res.status(500).end();
  }
};

module.exports = { uploadImage, updateCaption, deleteImage, serveImage, MAX_IMAGE_BYTES };
