// Sponsor Management (partner's module, built to the agreed design).
// Organizer of the event (or admin) manages sponsors; the public sees confirmed + visible ones only.
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Sponsor = require('../models/Sponsor');
const { looksLike, TYPES } = require('../utils/eventImages');
const { MAX_LOGO_BYTES, validateSponsor, publicSponsors, sponsorshipMetrics, logoPath, SORT } = require('../utils/sponsors');

const canManage = (event, user) =>
  user.role === 'admin' || (user.role === 'organizer' && String(event.organizer_id) === String(user.userId));

async function loadEvent(req, res, { manage }) {
  if (!mongoose.isValidObjectId(req.params.eventId)) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }
  if (manage && !canManage(event, req.user)) {
    res.status(403).json({ message: 'Only the event organizer can manage sponsors' });
    return null;
  }
  return event;
}

async function loadSponsor(req, res, event) {
  if (!mongoose.isValidObjectId(req.params.sponsorId)) {
    res.status(404).json({ message: 'Sponsor not found' });
    return null;
  }
  const sponsor = await Sponsor.findOne({ _id: req.params.sponsorId, event_id: event._id });
  if (!sponsor) {
    res.status(404).json({ message: 'Sponsor not found' });
    return null;
  }
  return sponsor;
}

const managerView = (s) => {
  const obj = s.toObject ? s.toObject() : s;
  delete obj.logo_data;
  return { ...obj, logo_url: logoPath(obj) };
};

// GET /api/events/:eventId/sponsors   (public)
const listPublic = async (req, res) => {
  try {
    const event = await loadEvent(req, res, { manage: false });
    if (!event) return;
    res.json({ sponsors: await publicSponsors(event._id) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load sponsors', error: error.message });
  }
};

// GET /api/events/:eventId/sponsors/manage   (organizer: everything + summary)
const listManage = async (req, res) => {
  try {
    const event = await loadEvent(req, res, { manage: true });
    if (!event) return;
    const sponsors = await Sponsor.find({ event_id: event._id }).sort(SORT);
    res.json({
      event: { _id: event._id, event_name: event.event_name, date: event.date },
      sponsors: sponsors.map(managerView),
      summary: await sponsorshipMetrics(event._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load sponsors', error: error.message });
  }
};

// POST /api/events/:eventId/sponsors
const createSponsor = async (req, res) => {
  try {
    const event = await loadEvent(req, res, { manage: true });
    if (!event) return;
    const { data, error } = validateSponsor(req.body);
    if (error) return res.status(400).json({ message: error });
    const sponsor = await Sponsor.create({ ...data, event_id: event._id });
    res.status(201).json({ message: 'Sponsor added', sponsor: managerView(sponsor) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add sponsor', error: error.message });
  }
};

// PUT /api/events/:eventId/sponsors/:sponsorId   (only the fields sent are changed)
const updateSponsor = async (req, res) => {
  try {
    const event = await loadEvent(req, res, { manage: true });
    if (!event) return;
    const sponsor = await loadSponsor(req, res, event);
    if (!sponsor) return;
    const { data, error } = validateSponsor(req.body, { partial: true });
    if (error) return res.status(400).json({ message: error });
    Object.assign(sponsor, data);
    await sponsor.save();
    res.json({ message: 'Sponsor saved', sponsor: managerView(sponsor) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save sponsor', error: error.message });
  }
};

// DELETE /api/events/:eventId/sponsors/:sponsorId
const deleteSponsor = async (req, res) => {
  try {
    const event = await loadEvent(req, res, { manage: true });
    if (!event) return;
    const sponsor = await loadSponsor(req, res, event);
    if (!sponsor) return;
    await sponsor.deleteOne();
    res.json({ message: 'Sponsor removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove sponsor', error: error.message });
  }
};

// PUT /api/events/:eventId/sponsors/:sponsorId/logo   body: raw PNG/JPEG/WebP (≤ 2 MB)
const uploadLogo = async (req, res) => {
  try {
    const event = await loadEvent(req, res, { manage: true });
    if (!event) return;
    const sponsor = await loadSponsor(req, res, event);
    if (!sponsor) return;
    const type = (req.headers['content-type'] || '').split(';')[0].trim();
    if (!TYPES.includes(type) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: 'Upload a PNG, JPEG or WebP image' });
    }
    if (req.body.length > MAX_LOGO_BYTES) return res.status(400).json({ message: 'Logo is larger than 2 MB' });
    if (!looksLike(type, req.body)) return res.status(400).json({ message: 'The file is not a valid PNG, JPEG or WebP image' });
    sponsor.logo_type = type;
    sponsor.logo_data = req.body;
    sponsor.logo_updated_at = new Date();
    await sponsor.save();
    res.json({ message: 'Logo saved', sponsor: managerView(sponsor) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save logo', error: error.message });
  }
};

// DELETE /api/events/:eventId/sponsors/:sponsorId/logo
const deleteLogo = async (req, res) => {
  try {
    const event = await loadEvent(req, res, { manage: true });
    if (!event) return;
    const sponsor = await loadSponsor(req, res, event);
    if (!sponsor) return;
    sponsor.logo_type = undefined;
    sponsor.logo_data = undefined;
    sponsor.logo_updated_at = undefined;
    await sponsor.save();
    res.json({ message: 'Logo removed', sponsor: managerView(sponsor) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove logo', error: error.message });
  }
};

// GET /api/events/:eventId/sponsors/:sponsorId/logo   (public, cached; URL changes with the logo)
const serveLogo = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.sponsorId)) return res.status(404).end();
    const s = await Sponsor.findOne({ _id: req.params.sponsorId, event_id: req.params.eventId }).select('+logo_data logo_type');
    if (!s || !s.logo_data) return res.status(404).end();
    res.set({
      'Content-Type': s.logo_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(s.logo_data);
  } catch (error) {
    res.status(500).end();
  }
};

module.exports = {
  listPublic,
  listManage,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  uploadLogo,
  deleteLogo,
  serveLogo,
  MAX_LOGO_BYTES,
};
