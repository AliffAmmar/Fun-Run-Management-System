// Certificate endpoints. Event-level actions: that event's organizer or an admin.
// Downloads: the buyer of the order, the organizer, or an admin. Verification: public.
const mongoose = require('mongoose');
const archiver = require('archiver');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Certificate = require('../models/Certificate');
const CertificateBackground = require('../models/CertificateBackground');
const { renderCertificatePdf } = require('../utils/certificatePdf');
const { sponsorLogos } = require('../utils/sponsors');
const {
  getEligibleParticipants,
  createCertificates,
  buildCertificatePdf,
  processPendingCertificates,
} = require('../utils/certificates');

const MAX_BACKGROUND_BYTES = 4 * 1024 * 1024;

const canManage = (event, user) =>
  user.role === 'admin' || (user.role === 'organizer' && String(event.organizer_id) === String(user.userId));
const kickSender = () =>
  setImmediate(() => processPendingCertificates().catch((e) => console.error('[certificates]', e.message)));
const safeFile = (s) => String(s).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'certificate';

async function loadManagedEvent(req, res) {
  if (!mongoose.isValidObjectId(req.params.eventId)) {
    res.status(400).json({ message: 'Invalid event id' });
    return null;
  }
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }
  if (!canManage(event, req.user)) {
    res.status(403).json({ message: 'Only the event organizer can manage certificates' });
    return null;
  }
  return event;
}

// GET /api/certificates/events/:eventId: settings, counts and the certificate list.
const getEventCertificates = async (req, res) => {
  try {
    const event = await loadManagedEvent(req, res);
    if (!event) return;

    const [certs, eligible, hasBackground] = await Promise.all([
      Certificate.find({ event_id: event._id }).sort({ createdAt: 1 }).lean(),
      getEligibleParticipants(event),
      CertificateBackground.exists({ event_id: event._id }),
    ]);
    const participants = await Participant.find({ _id: { $in: certs.map((c) => c.participant_id) } })
      .select('name email bib_number order_id')
      .lean();
    const orders = await Order.find({ _id: { $in: participants.map((p) => p.order_id) } }).select('order_no').lean();
    const pById = new Map(participants.map((p) => [String(p._id), p]));
    const oById = new Map(orders.map((o) => [String(o._id), o.order_no]));

    const counts = { pending: 0, sent: 0, failed: 0, skipped_no_email: 0 };
    certs.forEach((c) => {
      counts[c.status] += 1;
    });

    res.json({
      event: {
        _id: event._id,
        event_name: event.event_name,
        date: event.date,
        status: event.status,
        completed_at: event.completed_at,
        certificate_eligibility: event.certificate_eligibility,
        certificate_text_color: event.certificate_text_color,
      },
      has_background: Boolean(hasBackground),
      eligible_count: eligible.length,
      counts,
      certificates: certs.map((c) => {
        const p = pById.get(String(c.participant_id)) || {};
        return {
          certificate_no: c.certificate_no,
          status: c.status,
          attempts: c.attempts,
          sent_at: c.sent_at,
          error: c.error,
          name: p.name,
          email: p.email,
          bib_number: p.bib_number,
          order_no: oById.get(String(p.order_id)),
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load certificates', error: error.message });
  }
};

// PUT /api/certificates/events/:eventId/settings  { certificate_eligibility?, certificate_text_color? }
const updateSettings = async (req, res) => {
  try {
    const event = await loadManagedEvent(req, res);
    if (!event) return;
    const { certificate_eligibility, certificate_text_color } = req.body || {};
    if (certificate_eligibility !== undefined) {
      if (!['all_paid', 'kit_collected', 'checked_in'].includes(certificate_eligibility)) {
        return res.status(400).json({ message: 'Invalid eligibility' });
      }
      event.certificate_eligibility = certificate_eligibility;
    }
    if (certificate_text_color !== undefined) {
      if (!['dark', 'light'].includes(certificate_text_color)) {
        return res.status(400).json({ message: 'Text colour must be dark or light' });
      }
      event.certificate_text_color = certificate_text_color;
    }
    await event.save();
    res.json({ message: 'Certificate settings saved' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save settings', error: error.message });
  }
};

// PUT /api/certificates/events/:eventId/background   body: raw PNG/JPEG (Content-Type image/png|jpeg)
const uploadBackground = async (req, res) => {
  try {
    const event = await loadManagedEvent(req, res);
    if (!event) return;
    const type = (req.headers['content-type'] || '').split(';')[0].trim();
    if (!['image/png', 'image/jpeg'].includes(type) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: 'Upload a PNG or JPEG image' });
    }
    if (req.body.length > MAX_BACKGROUND_BYTES) {
      return res.status(400).json({ message: 'Image is larger than 4 MB' });
    }
    // Check the file really is that image type (magic bytes).
    const isPng = req.body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = req.body[0] === 0xff && req.body[1] === 0xd8;
    if ((type === 'image/png' && !isPng) || (type === 'image/jpeg' && !isJpeg)) {
      return res.status(400).json({ message: 'The file is not a valid PNG or JPEG image' });
    }
    await CertificateBackground.findOneAndUpdate(
      { event_id: event._id },
      { content_type: type, data: req.body },
      { upsert: true }
    );
    res.json({ message: 'Background uploaded' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload background', error: error.message });
  }
};

// DELETE /api/certificates/events/:eventId/background → back to the built-in design
const deleteBackground = async (req, res) => {
  try {
    const event = await loadManagedEvent(req, res);
    if (!event) return;
    await CertificateBackground.deleteOne({ event_id: event._id });
    res.json({ message: 'Background removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove background', error: error.message });
  }
};

// GET /api/certificates/events/:eventId/preview?name=... → sample PDF with the current settings
const previewCertificate = async (req, res) => {
  try {
    const event = await loadManagedEvent(req, res);
    if (!event) return;
    const background = await CertificateBackground.findOne({ event_id: event._id });
    const pdf = await renderCertificatePdf(
      {
        name: String(req.query.name || 'Nur Aisyah binti Ahmad').slice(0, 100),
        event_name: event.event_name,
        event_date: event.date,
        location: event.location,
        race_category: event.categories?.[0]?.name || '5km',
        bib_number: '0042',
        certificate_no: 'FR-C-PREVIEW0',
      },
      { textColor: event.certificate_text_color, background, sponsors: await sponsorLogos(event._id) }
    );
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="certificate-preview.pdf"' });
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ message: 'Failed to build preview', error: error.message });
  }
};

// POST /api/certificates/events/:eventId/complete
// "Mark event as completed": creates certificates for eligible runners and starts sending in the
// background. Safe to press again (only missing certificates are added).
const completeEvent = async (req, res) => {
  try {
    const event = await loadManagedEvent(req, res);
    if (!event) return;
    if (event.status === 'draft') {
      return res.status(400).json({ message: 'A draft event cannot be completed' });
    }
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (new Date(event.date) > endOfToday) {
      return res.status(400).json({ message: 'The event has not taken place yet' });
    }

    if (event.status !== 'completed') {
      event.status = 'completed';
      event.completed_at = new Date();
      await event.save();
    }
    const { eligible, created } = await createCertificates(event);
    kickSender();

    res.json({
      message:
        created > 0
          ? `Event completed. ${created} certificate(s) created and being sent in the background.`
          : 'Event completed. No new certificates to create.',
      eligible,
      created,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to complete event', error: error.message });
  }
};

// POST /api/certificates/:certificateNo/resend   { name? }
// Organizer re-sends one certificate, optionally fixing the name first.
const resendCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificate_no: req.params.certificateNo });
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });
    const event = await Event.findById(cert.event_id);
    if (!event || !canManage(event, req.user)) return res.status(403).json({ message: 'Not authorized' });

    const name = req.body?.name !== undefined ? String(req.body.name).trim().replace(/\s+/g, ' ') : undefined;
    if (name !== undefined) {
      if (!name || name.length > 100) return res.status(400).json({ message: 'Name must be 1–100 characters' });
      await Participant.updateOne({ _id: cert.participant_id }, { name });
    }
    await Certificate.updateOne({ _id: cert._id }, { status: 'pending', attempts: 0, $unset: { error: '' } });
    kickSender();
    res.json({ message: 'Certificate queued to be sent again' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to resend certificate', error: error.message });
  }
};

// Access for downloads: the buyer of the order, the event's organizer, or an admin.
async function canDownload(order, user) {
  if (user.role === 'admin' || String(order.user_id) === String(user.userId)) return true;
  const event = await Event.findById(order.event_id).select('organizer_id');
  return Boolean(event) && canManage(event, user);
}

// GET /api/certificates/:certificateNo/pdf
const downloadCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificate_no: req.params.certificateNo });
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });
    const order = await Order.findById(cert.order_id);
    if (!order || !(await canDownload(order, req.user))) return res.status(403).json({ message: 'Not authorized' });

    const pdf = await buildCertificatePdf(cert);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFile(cert.certificate_no)}.pdf"`,
    });
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ message: 'Failed to download certificate', error: error.message });
  }
};

// GET /api/certificates/orders/:orderNo/zip: every certificate in an order, as one ZIP.
const downloadOrderZip = async (req, res) => {
  try {
    const order = await Order.findOne({ order_no: req.params.orderNo });
    if (!order) return res.status(404).json({ message: 'Registration not found' });
    if (!(await canDownload(order, req.user))) return res.status(403).json({ message: 'Not authorized' });

    const certs = await Certificate.find({ order_id: order._id });
    if (certs.length === 0) return res.status(404).json({ message: 'No certificates for this registration yet' });
    const [event, participants] = await Promise.all([
      Event.findById(order.event_id),
      Participant.find({ order_id: order._id }),
    ]);
    const pById = new Map(participants.map((p) => [String(p._id), p]));

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeFile(`${order.order_no}-certificates`)}.zip"`,
    });
    const zip = archiver('zip', { zlib: { level: 6 } });
    zip.on('error', (err) => res.destroy(err));
    zip.pipe(res);
    for (const cert of certs) {
      const participant = pById.get(String(cert.participant_id));
      const pdf = await buildCertificatePdf(cert, { participant, event });
      zip.append(pdf, { name: `${safeFile(`${participant?.bib_number || ''}-${participant?.name || cert.certificate_no}`)}.pdf` });
    }
    await zip.finalize();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ message: 'Failed to build ZIP', error: error.message });
    else res.destroy(error);
  }
};

// GET /api/certificates/verify/:certificateNo (public): only name, category and event.
const verifyCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificate_no: String(req.params.certificateNo).toUpperCase() });
    if (!cert) return res.status(404).json({ valid: false, message: 'No certificate with this number' });
    const [participant, order, event] = await Promise.all([
      Participant.findById(cert.participant_id).select('name'),
      Order.findById(cert.order_id).select('race_category'),
      Event.findById(cert.event_id).select('event_name date'),
    ]);
    if (!participant || !event) return res.status(404).json({ valid: false, message: 'No certificate with this number' });
    res.json({
      valid: true,
      certificate_no: cert.certificate_no,
      name: participant.name,
      race_category: order?.race_category,
      event_name: event.event_name,
      event_date: event.date,
    });
  } catch (error) {
    res.status(500).json({ message: 'Verification failed', error: error.message });
  }
};

module.exports = {
  getEventCertificates,
  updateSettings,
  uploadBackground,
  deleteBackground,
  previewCertificate,
  completeEvent,
  resendCertificate,
  downloadCertificate,
  downloadOrderZip,
  verifyCertificate,
  MAX_BACKGROUND_BYTES,
};
