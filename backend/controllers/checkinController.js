// Kit collection + event-day check-in, by scanning the order's QR (/checkin/:order_no).
//
// Access ("Gate 1"): only the organizer of the order's event, or an admin. Staff log in with the
// organizer's account on their phones. The buyer is told to go to their own ticket; anyone else
// gets "not authorized" and NO order details (names/phones are never exposed).
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const User = require('../models/User');
const CheckinLog = require('../models/CheckinLog');
const { escapeRegex } = require('../utils/regex');

const ACTIONS = {
  collect: { flag: 'kit_collected', at: 'kit_collected_at', by: 'kit_collected_by', log: 'kit_collected', label: 'Kit' },
  checkin: { flag: 'checked_in', at: 'checked_in_at', by: 'checked_in_by', log: 'checked_in', label: 'Check-in' },
};
const MIN_REASON_LENGTH = 3;

const canWork = (event, user) =>
  user.role === 'admin' ||
  (user.role === 'organizer' && event && String(event.organizer_id) === String(user.userId));

// Loads the order + event and applies the access rules. Returns { order, event } or sends the
// response itself and returns null.
async function loadForStaff(req, res) {
  const order = await Order.findOne({ order_no: String(req.params.order_no).toUpperCase() });
  if (!order) {
    res.status(404).json({ message: 'No registration with this code' });
    return null;
  }
  const event = await Event.findById(order.event_id);
  if (!canWork(event, req.user)) {
    if (String(order.user_id) === String(req.user.userId)) {
      res.status(403).json({ message: 'This is your own registration', is_buyer: true, order_no: order.order_no });
    } else {
      res.status(403).json({ message: 'Not authorized. Log in with the event organizer account.' });
    }
    return null;
  }
  return { order, event };
}

// Everything the check-in page shows.
async function buildView(order, event, workingEventId) {
  const [buyer, participants, logs] = await Promise.all([
    User.findById(order.user_id).select('name email phone_no'),
    Participant.find({ order_id: order._id }).sort({ bib_number: 1, _id: 1 }).select('name shirt_size bib_number'),
    CheckinLog.find({ order_id: order._id }).sort({ at: -1 }).limit(20).populate('by', 'name'),
  ]);

  const shirt_sizes = Object.fromEntries(Participant.SHIRT_SIZES.map((s) => [s, 0]));
  participants.forEach((p) => {
    shirt_sizes[p.shirt_size] += 1;
  });
  const bibs = participants.map((p) => p.bib_number).filter(Boolean);

  const expired = order.status === 'pending' && order.expires_at <= new Date();
  const valid = order.status === 'paid';
  const warnings = [];
  if (!valid) {
    const why = expired ? 'expired without payment' : order.status === 'pending' ? 'not paid' : order.status;
    warnings.push({ level: 'error', message: `Not a valid registration (${why}). Do not hand over kits.` });
  }
  if (workingEventId && String(workingEventId) !== String(event._id)) {
    warnings.push({ level: 'warning', message: `This registration is for a different event: ${event.event_name}.` });
  }

  return {
    order: {
      order_no: order.order_no,
      type: order.type,
      group_name: order.group_name,
      race_category: order.race_category,
      participant_count: order.participant_count,
      status: expired ? 'expired' : order.status,
      paid_at: order.paid_at,
      kit_collected: order.kit_collected,
      kit_collected_at: order.kit_collected_at,
      checked_in: order.checked_in,
      checked_in_at: order.checked_in_at,
    },
    event: { _id: event._id, event_name: event.event_name, date: event.date, location: event.location },
    buyer: buyer ? { name: buyer.name, phone_no: buyer.phone_no, email: buyer.email } : null,
    participants,
    shirt_sizes,
    bib_range: bibs.length ? (bibs.length === 1 ? bibs[0] : `${bibs[0]}–${bibs[bibs.length - 1]}`) : null,
    valid,
    warnings,
    log: logs.map((l) => ({ action: l.action, at: l.at, by: l.by?.name, reason: l.reason })),
  };
}

// GET /api/checkin/:order_no?event_id=<event being worked>
const getCheckin = async (req, res) => {
  try {
    const loaded = await loadForStaff(req, res);
    if (!loaded) return;
    res.json(await buildView(loaded.order, loaded.event, req.query.event_id));
  } catch (error) {
    res.status(500).json({ message: 'Failed to load registration', error: error.message });
  }
};

// POST /api/checkin/:order_no/collect   and   /checkin
// Whole order at once (the leader collects all kits). Only paid orders. Second tap → 409.
const mark = (actionKey) => async (req, res) => {
  const a = ACTIONS[actionKey];
  try {
    const loaded = await loadForStaff(req, res);
    if (!loaded) return;
    const { order, event } = loaded;

    if (order.status !== 'paid') {
      return res.status(400).json({ message: 'Not a valid registration (not paid). Do not hand over kits.' });
    }

    // Atomic: two phones tapping at once → only one succeeds.
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: 'paid', [a.flag]: { $ne: true } },
      { $set: { [a.flag]: true, [a.at]: new Date(), [a.by]: req.user.userId } },
      { new: true }
    );
    if (!updated) {
      const current = await Order.findById(order._id);
      return res.status(409).json({
        message: `${a.label} already recorded`,
        at: current[a.at],
      });
    }

    await CheckinLog.create({ order_id: order._id, event_id: event._id, action: a.log, by: req.user.userId });
    res.json({ message: `${a.label} recorded`, ...(await buildView(updated, event, req.query.event_id)) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record', error: error.message });
  }
};

// POST /api/checkin/:order_no/undo   body: { action: 'collect'|'checkin', reason }
const undo = async (req, res) => {
  try {
    const a = ACTIONS[req.body?.action];
    if (!a) return res.status(400).json({ message: "action must be 'collect' or 'checkin'" });
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < MIN_REASON_LENGTH) {
      return res.status(400).json({ message: 'Please give a reason for the undo' });
    }

    const loaded = await loadForStaff(req, res);
    if (!loaded) return;
    const { order, event } = loaded;

    const updated = await Order.findOneAndUpdate(
      { _id: order._id, [a.flag]: true },
      { $set: { [a.flag]: false }, $unset: { [a.at]: '', [a.by]: '' } },
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: `${a.label} was not recorded, nothing to undo` });

    await CheckinLog.create({
      order_id: order._id,
      event_id: event._id,
      action: `undo_${a.log}`,
      by: req.user.userId,
      reason,
    });
    res.json({ message: `${a.label} undone`, ...(await buildView(updated, event, req.query.event_id)) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to undo', error: error.message });
  }
};

// GET /api/checkin/search?event_id=...&q=...
// Fallback when a QR is lost: search by order number, group name, buyer name or member name.
// Without q: all paid orders for the event. Also returns kit/check-in totals.
const search = async (req, res) => {
  try {
    const { event_id } = req.query;
    if (!mongoose.isValidObjectId(event_id)) return res.status(400).json({ message: 'event_id is required' });
    const event = await Event.findById(event_id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!canWork(event, req.user)) return res.status(403).json({ message: 'Not authorized' });

    const q = String(req.query.q || '').trim().slice(0, 100);
    const filter = { event_id: event._id };
    const matchedMember = new Map(); // order_id → member name that matched

    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      const [buyerIds, members] = await Promise.all([
        User.find({ name: re }).distinct('_id'),
        Participant.find({ event_id: event._id, name: re }).select('order_id name').limit(200),
      ]);
      members.forEach((m) => {
        if (!matchedMember.has(String(m.order_id))) matchedMember.set(String(m.order_id), m.name);
      });
      filter.$or = [
        { order_no: new RegExp(`^${escapeRegex(q)}`, 'i') },
        { group_name: re },
        { user_id: { $in: buyerIds } },
        { _id: { $in: members.map((m) => m.order_id) } },
      ];
    } else {
      filter.status = 'paid';
    }

    const orders = await Order.find(filter).sort({ order_no: 1 }).limit(100).populate('user_id', 'name');
    const now = new Date();

    const [totals] = await Order.aggregate([
      { $match: { event_id: event._id, status: 'paid' } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          runners: { $sum: '$participant_count' },
          kits_collected_orders: { $sum: { $cond: ['$kit_collected', 1, 0] } },
          kits_collected_runners: { $sum: { $cond: ['$kit_collected', '$participant_count', 0] } },
          checked_in_orders: { $sum: { $cond: ['$checked_in', 1, 0] } },
          checked_in_runners: { $sum: { $cond: ['$checked_in', '$participant_count', 0] } },
        },
      },
    ]);

    res.json({
      event: { _id: event._id, event_name: event.event_name, date: event.date },
      results: orders.map((o) => ({
        order_no: o.order_no,
        type: o.type,
        group_name: o.group_name,
        buyer_name: o.user_id?.name,
        participant_count: o.participant_count,
        race_category: o.race_category,
        status: o.status === 'pending' && o.expires_at <= now ? 'expired' : o.status,
        kit_collected: o.kit_collected,
        checked_in: o.checked_in,
        matched_member: matchedMember.get(String(o._id)),
      })),
      totals: totals
        ? { ...totals, _id: undefined }
        : { orders: 0, runners: 0, kits_collected_orders: 0, kits_collected_runners: 0, checked_in_orders: 0, checked_in_runners: 0 },
    });
  } catch (error) {
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};

module.exports = {
  getCheckin,
  markCollected: mark('collect'),
  markCheckedIn: mark('checkin'),
  undo,
  search,
};
