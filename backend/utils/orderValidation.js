// Validation for the participant list of an order (typed into the table or uploaded as CSV).
// The frontend validates too, for instant feedback, but the server never trusts it:
// everything is checked again here.
//
// Rows are reported 1-based ("Row 3"), matching what the user sees in the table / CSV
// (CSV header line excluded).

const Participant = require('../models/Participant');
const Order = require('../models/Order');

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MAX_NAME_LENGTH = 100;

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// Returns { participants, errors }. `participants` are the cleaned rows (only meaningful when
// errors is empty). Each error: { row, field, message }.
function validateParticipants(rows) {
  const errors = [];
  const participants = [];
  const firstRowForEmail = new Map();

  rows.forEach((raw, i) => {
    const row = i + 1;
    const r = raw && typeof raw === 'object' ? raw : {};
    const name = clean(r.name).replace(/\s+/g, ' ');
    const email = clean(r.email).toLowerCase();
    const shirt_size = clean(r.shirt_size).toUpperCase();
    const emergency_contact = clean(r.emergency_contact);

    if (!name) {
      errors.push({ row, field: 'name', message: `Row ${row}: name is required` });
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.push({ row, field: 'name', message: `Row ${row}: name is longer than ${MAX_NAME_LENGTH} characters` });
    }

    if (!shirt_size) {
      errors.push({ row, field: 'shirt_size', message: `Row ${row}: shirt size is required` });
    } else if (!Participant.SHIRT_SIZES.includes(shirt_size)) {
      errors.push({
        row,
        field: 'shirt_size',
        message: `Row ${row}: shirt size "${r.shirt_size}" is not one of ${Participant.SHIRT_SIZES.join(', ')}`,
      });
    }

    if (email) {
      if (!EMAIL_RE.test(email)) {
        errors.push({ row, field: 'email', message: `Row ${row}: "${r.email}" is not a valid email` });
      } else if (firstRowForEmail.has(email)) {
        errors.push({
          row,
          field: 'email',
          message: `Row ${row}: ${email} is already used in row ${firstRowForEmail.get(email)} of this group`,
        });
      } else {
        firstRowForEmail.set(email, row);
      }
    }

    participants.push({
      name,
      email: email || undefined,
      shirt_size,
      emergency_contact: emergency_contact || undefined,
    });
  });

  return { participants, errors };
}

// Emails in `participants` that are already registered for this event in another order that
// still counts (paid, or pending and not expired). These are WARNINGS only: the order is still
// accepted (e.g. a parent may register their child with their own email).
async function findDuplicateEmailWarnings(eventId, participants, now = new Date()) {
  const emails = participants.map((p) => p.email).filter(Boolean);
  if (emails.length === 0) return [];

  const activeOrderIds = await Order.find({
    event_id: eventId,
    $or: [{ status: 'paid' }, { status: 'pending', expires_at: { $gt: now } }],
  }).distinct('_id');

  const existing = await Participant.find({
    order_id: { $in: activeOrderIds },
    email: { $in: emails },
  }).distinct('email');
  const taken = new Set(existing);

  return participants
    .map((p, i) => ({ p, row: i + 1 }))
    .filter(({ p }) => p.email && taken.has(p.email))
    .map(({ p, row }) => ({
      row,
      field: 'email',
      message: `Row ${row}: ${p.email} is already registered for this event`,
    }));
}

module.exports = { validateParticipants, findDuplicateEmailWarnings, MAX_NAME_LENGTH };
