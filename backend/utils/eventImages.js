// Event pictures: validation + adding their URLs to event JSON.
const EventImage = require('../models/EventImage');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INFO_IMAGES = 12;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Checks the bytes really are the declared image type (not just the header the client sent).
function looksLike(type, buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  if (type === 'image/png') return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (type === 'image/webp') return buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  return false;
}

// Path (relative to the API base, e.g. "/api") for an image. The id changes on replace, so it can
// be cached forever.
const imagePath = (eventId, imageId) => `/events/${eventId}/images/${imageId}`;

// Adds `cover_image` (path or null) and `info_images` [{ _id, caption, url }] to events.
async function attachImages(events) {
  if (events.length === 0) return events;
  const images = await EventImage.find({ event_id: { $in: events.map((e) => e._id) } })
    .select('event_id kind caption createdAt')
    .sort({ createdAt: 1 })
    .lean();
  const byEvent = new Map();
  images.forEach((img) => {
    const key = String(img.event_id);
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(img);
  });
  return events.map((e) => {
    const list = byEvent.get(String(e._id)) || [];
    const cover = list.find((i) => i.kind === 'cover');
    return {
      ...e,
      cover_image: cover ? imagePath(e._id, cover._id) : null,
      info_images: list
        .filter((i) => i.kind === 'info')
        .map((i) => ({ _id: i._id, caption: i.caption || '', url: imagePath(e._id, i._id) })),
    };
  });
}

module.exports = { MAX_IMAGE_BYTES, MAX_INFO_IMAGES, TYPES, looksLike, imagePath, attachImages };
