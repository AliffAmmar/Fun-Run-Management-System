const Counter = require('../models/Counter');
const Participant = require('../models/Participant');

// Atomically adds `n` to a counter and returns the new value.
// Safe under concurrency: MongoDB applies $inc on a single document atomically.
async function increment(key, n = 1) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: n } },
    { upsert: true, new: true }
  );
  return counter.seq;
}

// ---- Order numbers ----------------------------------------------------------
// Short, readable and unique: FR-1001, FR-1002, ... Used on the ticket, emails, the QR link
// (/checkin/FR-1001) and in search.
const ORDER_NO_START = 1000;

async function nextOrderNo() {
  const seq = await increment('order_no');
  return `FR-${ORDER_NO_START + seq}`;
}

// ---- Bib numbers ------------------------------------------------------------
// Bib FORMAT is still pending the collaborator (plain "0001" vs per-category prefix).
// Change it here only.
function formatBib(seq /* , order */) {
  return String(seq).padStart(4, '0');
}

// Gives every participant in the order that has no bib yet a bib number.
// Reserves one consecutive block for the whole group with a single atomic $inc,
// so concurrent orders for the same event can never get the same numbers.
// The unique index on { event_id, bib_number } is the backstop.
// Call it from fulfilOrder, after the order is marked paid. Calling it again for the same
// order does nothing (only participants without a bib are numbered).
async function assignBibNumbers(order) {
  const participants = await Participant.find({
    order_id: order._id,
    bib_number: { $exists: false },
  }).sort({ _id: 1 });

  if (participants.length === 0) return [];

  const last = await increment(`bib:${order.event_id}`, participants.length);
  const first = last - participants.length + 1;

  await Participant.bulkWrite(
    participants.map((p, i) => ({
      updateOne: {
        // Only set if still empty, in case a parallel call got here first.
        filter: { _id: p._id, bib_number: { $exists: false } },
        update: { $set: { bib_number: formatBib(first + i, order) } },
      },
    }))
  );

  return Participant.find({ order_id: order._id }).sort({ bib_number: 1 });
}

module.exports = { nextOrderNo, assignBibNumbers, formatBib };
