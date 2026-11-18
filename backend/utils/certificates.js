// Certificate automation (CLAUDE.md §4.6).
//
//   completeEvent → createCertificates(event)  one record per eligible participant (unique, so
//                                                completing twice never duplicates)
//   background    → processPendingCertificates() emails pending certificates in batches,
//                                                up to 3 attempts each, stops before the daily
//                                                email cap and continues on the next run.
//                   Runs on server start (resumes after a restart) and every 10 minutes.
const crypto = require('crypto');
const Certificate = require('../models/Certificate');
const CertificateBackground = require('../models/CertificateBackground');
const Participant = require('../models/Participant');
const Order = require('../models/Order');
const Event = require('../models/Event');
const User = require('../models/User');
const { renderCertificatePdf } = require('./certificatePdf');
const { sendEmail, emailsSentToday, dailyLimit } = require('./email');
const { certificateEmail, certificatesReadyEmail } = require('./emailTemplates');

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;
// Kept free each day for order confirmations and password resets.
const RESERVED_EMAILS = 25;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

function newCertificateNo() {
  const bytes = crypto.randomBytes(8);
  return `FR-C-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

// Who gets a certificate, per the event's setting (undecided with the collaborator):
//   all_paid      every runner in a paid order (default)
//   kit_collected only runners ticked as having collected their kit
//   checked_in    only runners ticked as checked in on event day
async function getEligibleParticipants(event) {
  const orderIds = await Order.find({ event_id: event._id, status: 'paid' }).distinct('_id');
  const filter = { order_id: { $in: orderIds } };
  if (event.certificate_eligibility === 'kit_collected') filter.kit_collected = true;
  if (event.certificate_eligibility === 'checked_in') filter.checked_in = true;
  return Participant.find(filter).sort({ bib_number: 1, _id: 1 });
}

// Creates missing certificate records. Returns { eligible, created }.
async function createCertificates(event) {
  const eligible = await getEligibleParticipants(event);
  const existing = new Set(
    (await Certificate.find({ event_id: event._id }).distinct('participant_id')).map(String)
  );
  let created = 0;
  for (const p of eligible) {
    if (existing.has(String(p._id))) continue;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await Certificate.create({
          participant_id: p._id,
          order_id: p.order_id,
          event_id: event._id,
          certificate_no: newCertificateNo(),
        });
        created += 1;
        break;
      } catch (err) {
        if (err.code !== 11000) throw err;
        if (err.keyPattern?.participant_id) break; // created meanwhile by a parallel call
        // certificate_no collision (very unlikely): try a new number
      }
    }
  }
  return { eligible: eligible.length, created };
}

// PDF for one certificate (loads participant, event and the optional background).
async function buildCertificatePdf(certificate, { participant, event } = {}) {
  const [p, ev, bg] = await Promise.all([
    participant || Participant.findById(certificate.participant_id),
    event || Event.findById(certificate.event_id),
    CertificateBackground.findOne({ event_id: certificate.event_id }),
  ]);
  const order = await Order.findById(p.order_id).select('race_category');
  return renderCertificatePdf(
    {
      name: p.name,
      event_name: ev.event_name,
      event_date: ev.date,
      location: ev.location,
      race_category: order?.race_category || '',
      bib_number: p.bib_number,
      certificate_no: certificate.certificate_no,
    },
    { textColor: ev.certificate_text_color, background: bg }
  );
}

let running = null;

// Sends pending certificates. Safe to call any time; concurrent calls share one run.
function processPendingCertificates(options = {}) {
  if (!running) {
    running = runQueue(options).finally(() => {
      running = null;
    });
  }
  return running;
}

async function runQueue({ limit = dailyLimit(), reserve = RESERVED_EMAILS } = {}) {
  const result = { sent: 0, skipped: 0, failed: 0, notices: 0, stoppedForDailyLimit: false };
  let budget = Math.max(0, limit - reserve - (await emailsSentToday()));
  const events = new Map();
  const getEvent = async (id) => {
    if (!events.has(String(id))) events.set(String(id), await Event.findById(id));
    return events.get(String(id));
  };

  // ---- Certificates ----
  for (;;) {
    const batch = await Certificate.find({ status: 'pending', attempts: { $lt: MAX_ATTEMPTS } })
      .sort({ createdAt: 1 })
      .limit(BATCH_SIZE);
    if (batch.length === 0) break;

    for (const cert of batch) {
      const participant = await Participant.findById(cert.participant_id);
      if (!participant) {
        await Certificate.updateOne({ _id: cert._id }, { status: 'failed', error: 'Participant no longer exists' });
        result.failed += 1;
        continue;
      }
      if (!participant.email) {
        await Certificate.updateOne({ _id: cert._id }, { status: 'skipped_no_email', $unset: { error: '' } });
        result.skipped += 1;
        continue;
      }
      if (budget <= 0) {
        result.stoppedForDailyLimit = true;
        return finish(result);
      }

      const event = await getEvent(cert.event_id);
      try {
        const pdf = await buildCertificatePdf(cert, { participant, event });
        await sendEmail({
          to: participant.email,
          ...certificateEmail({ participant, event, certificateNo: cert.certificate_no, pdf }),
        });
        budget -= 1;
        await Certificate.updateOne(
          { _id: cert._id },
          { status: 'sent', sent_at: new Date(), $inc: { attempts: 1 }, $unset: { error: '' } }
        );
        result.sent += 1;
      } catch (err) {
        const attempts = cert.attempts + 1;
        await Certificate.updateOne(
          { _id: cert._id },
          { attempts, error: err.message, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' }
        );
        if (attempts >= MAX_ATTEMPTS) result.failed += 1;
      }
    }
  }

  // ---- One "certificates ready in My Tickets" notice per order with members without email ----
  const orderIds = await Certificate.find({ status: 'skipped_no_email' }).distinct('order_id');
  const orders = await Order.find({ _id: { $in: orderIds }, certificates_notice_sent_at: { $exists: false } });
  for (const order of orders) {
    if (budget <= 0) {
      result.stoppedForDailyLimit = true;
      break;
    }
    // Claim first, so the notice is sent at most once even if two runs overlap.
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, certificates_notice_sent_at: { $exists: false } },
      { $set: { certificates_notice_sent_at: new Date() } }
    );
    if (!claimed) continue;
    try {
      const [buyer, event, count] = await Promise.all([
        User.findById(order.user_id),
        getEvent(order.event_id),
        Certificate.countDocuments({ order_id: order._id, status: 'skipped_no_email' }),
      ]);
      if (buyer?.email) {
        await sendEmail({ to: buyer.email, ...certificatesReadyEmail({ buyer, order, event, count }) });
        budget -= 1;
        result.notices += 1;
      }
    } catch (err) {
      // Un-claim so the next run retries.
      await Order.updateOne({ _id: order._id }, { $unset: { certificates_notice_sent_at: '' } });
      console.error(`[certificates] notice for ${order.order_no} failed:`, err.message);
    }
  }

  return finish(result);
}

function finish(result) {
  if (result.sent || result.skipped || result.failed || result.notices || result.stoppedForDailyLimit) {
    console.log('[certificates]', JSON.stringify(result));
  }
  return result;
}

// Called from server.js: resume pending work now, then check every 10 minutes
// (also picks up again the day after hitting the daily email cap).
function startCertificateWorker(intervalMs = 10 * 60 * 1000) {
  const tick = () =>
    processPendingCertificates().catch((err) => console.error('[certificates] worker error:', err.message));
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = {
  getEligibleParticipants,
  createCertificates,
  buildCertificatePdf,
  processPendingCertificates,
  startCertificateWorker,
  MAX_ATTEMPTS,
};
