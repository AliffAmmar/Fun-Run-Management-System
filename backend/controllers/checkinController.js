// Kit collection + event-day check-in, by scanning the order's QR (/checkin/:order_no).
//
// Access ("Gate 1"): only the organizer of the order's event, or an admin. Staff log in with the
// organizer's account on their phones. The buyer is told to go to their own ticket; anyone else
// gets "not authorized" and NO order details (names/phones are never exposed).
//
// Per runner (decided Nov 2026): staff tick each runner who collected their kit / checked in.
// The ORDER counts as kit collected / checked in only when every runner is ticked. When not
// everyone is ticked, staff can leave a remark (e.g. "3 will collect tomorrow").
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const User = require('../models/User');
const CheckinLog = require('../models/CheckinLog');
const { escapeRegex } = require('../utils/regex');

const ACTIONS = {
  collect: {
    flag: 'kit_collected',
    at: 'kit_collected_at',
    by: 'kit_collected_by',
    remark: 'kit_remark',
    log: 'kit_collected',
    label: 'Kit collection',
  },
  checkin: {
    flag: 'checked_in',
    at: 'checked_in_at',
    by: 'checked_in_by',
    remark: 'checkin_remark',
    log: 'checked_in',
    label: 'Check-in',
  },
};
const MIN_REASON_LENGTH = 3;
const MAX_REMARK_LENGTH = 500;

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

// Which runners an action applies to: `participant_ids` from the body, or all runners in the
// order when omitted ("select all"). Returns { ids } or { error }.
async function selectRunners(order, body) {
  const all = await Participant.find({ order_id: order._id }).select('_id').lean();
  const allIds = all.map((p) => String(p._id));
  if (body?.participant_ids === undefined) return { ids: allIds };
  if (!Array.isArray(body.participant_ids) || body.participant_ids.length === 0) {
    return { error: 'Select at least one runner' };
  }
  const wanted = [...new Set(body.participant_ids.map(String))];
  if (wanted.some((id) => !allIds.includes(id))) {
    return { error: 'Some selected runners are not in this registration' };
  }
  return { ids: wanted };
}

// Sets the order-level flag from its runners: true only when every runner is ticked.
async function syncOrderFlag(orderId, a, userId) {
  const remaining = await Participant.countDocuments({ order_id: orderId, [a.flag]: { $ne: true } });
  if (remaining === 0) {
    await Order.updateOne(
      { _id: orderId, [a.flag]: { $ne: true } },
      { $set: { [a.flag]: true, [a.at]: new Date(), [a.by]: userId } }
    );
  } else {
    await Order.updateOne({ _id: orderId }, { $set: { [a.flag]: false }, $unset: { [a.at]: '', [a.by]: '' } });
  }
  return Order.findById(orderId);
}

const cleanRemark = (v) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, MAX_REMARK_LENGTH);

// Everything the check-in page shows.
async function buildView(order, event, workingEventId) {
  const [buyer, participants, logs] = await Promise.all([
    User.findById(order.user_id).select('name email phone_no'),
    Participant.find({ order_id: order._id })
      .sort({ bib_number: 1, _id: 1 })
      .select('name shirt_size bib_number kit_collected kit_collected_at checked_in checked_in_at'),
    CheckinLog.find({ order_id: order._id }).sort({ at: -1 }).limit(30).populate('by', 'name'),
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
      kit_collected_count: participants.filter((p) => p.kit_collected).length,
      kit_remark: order.kit_remark,
      checked_in: order.checked_in,
      checked_in_at: order.checked_in_at,
      checked_in_count: participants.filter((p) => p.checked_in).length,
      checkin_remark: order.checkin_remark,
    },
    event: { _id: event._id, event_name: event.event_name, date: event.date, location: event.location },
    buyer: buyer ? { name: buyer.name, phone_no: buyer.phone_no, email: buyer.email } : null,
    participants,
    shirt_sizes,
    bib_range: bibs.length ? (bibs.length === 1 ? bibs[0] : `${bibs[0]}–${bibs[bibs.length - 1]}`) : null,
    valid,
    warnings,
    log: logs.map((l) => ({
      action: l.action,
      at: l.at,
      by: l.by?.name,
      count: l.count,
      reason: l.reason,
      remark: l.remark,
    })),
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
// body: { participant_ids?: [...], remark? }
//   participant_ids omitted → every runner ("select all"); only paid orders.
//   Runners already ticked are skipped; if nothing new is ticked and there's no remark → 409.
//   A remark alone (no new runners) just updates the note.
const mark = (actionKey) => async (req, res) => {
  const a = ACTIONS[actionKey];
  try {
    const loaded = await loadForStaff(req, res);
    if (!loaded) return;
    const { order, event } = loaded;

    if (order.status !== 'paid') {
      return res.status(400).json({ message: 'Not a valid registration (not paid). Do not hand over kits.' });
    }
    const remark = cleanRemark(req.body?.remark);
    const remarkOnly = Boolean(remark) && Array.isArray(req.body?.participant_ids) && req.body.participant_ids.length === 0;

    let newlyTicked = [];
    if (!remarkOnly) {
      const { ids, error } = await selectRunners(order, req.body);
      if (error) return res.status(400).json({ message: error });

      // Only runners not yet ticked. The flag in the filter makes it safe when two phones tap at
      // once: each runner is ticked by exactly one request.
      const candidates = await Participant.find({ _id: { $in: ids }, [a.flag]: { $ne: true } }).select('_id').lean();
      const now = new Date();
      const results = await Promise.all(
        candidates.map((p) =>
          Participant.updateOne(
            { _id: p._id, [a.flag]: { $ne: true } },
            { $set: { [a.flag]: true, [a.at]: now, [a.by]: req.user.userId } }
          ).then((r) => (r.modifiedCount ? p._id : null))
        )
      );
      newlyTicked = results.filter(Boolean);
    }

    if (newlyTicked.length === 0 && !remark) {
      return res.status(409).json({
        message: `${a.label} already recorded for ${req.body?.participant_ids ? 'the selected runners' : 'everyone'}`,
        at: order[a.at],
      });
    }

    const updated = await syncOrderFlag(order._id, a, req.user.userId);
    if (remark) {
      updated[a.remark] = remark;
      await updated.save();
    }

    await CheckinLog.create({
      order_id: order._id,
      event_id: event._id,
      action: newlyTicked.length ? a.log : a.remark,
      by: req.user.userId,
      participant_ids: newlyTicked,
      count: newlyTicked.length,
      remark: remark || undefined,
    });

    const total = order.participant_count;
    const done = await Participant.countDocuments({ order_id: order._id, [a.flag]: true });
    res.json({
      message: newlyTicked.length
        ? `${a.label}: ${newlyTicked.length} runner(s) recorded (${done} of ${total})`
        : 'Remark saved',
      ...(await buildView(updated, event, req.query.event_id)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record', error: error.message });
  }
};

// POST /api/checkin/:order_no/undo   body: { action: 'collect'|'checkin', reason, participant_ids? }
// Unticks the given runners (or everyone). A reason is required and logged.
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

    const { ids, error } = await selectRunners(order, req.body);
    if (error) return res.status(400).json({ message: error });

    const ticked = await Participant.find({ _id: { $in: ids }, [a.flag]: true }).select('_id').lean();
    if (ticked.length === 0) {
      return res.status(409).json({ message: `${a.label} was not recorded for them, nothing to undo` });
    }
    await Participant.updateMany(
      { _id: { $in: ticked.map((p) => p._id) } },
      { $set: { [a.flag]: false }, $unset: { [a.at]: '', [a.by]: '' } }
    );
    const updated = await syncOrderFlag(order._id, a, req.user.userId);

    await CheckinLog.create({
      order_id: order._id,
      event_id: event._id,
      action: `undo_${a.log}`,
      by: req.user.userId,
      participant_ids: ticked.map((p) => p._id),
      count: ticked.length,
      reason,
    });
    res.json({
      message: `${a.label} undone for ${ticked.length} runner(s)`,
      ...(await buildView(updated, event, req.query.event_id)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to undo', error: error.message });
  }
};

// GET /api/checkin/search?event_id=...&q=...
// Fallback when a QR is lost: search by order number, group name, buyer name or member name.
// Without q: all paid orders for the event. Also returns kit/check-in totals (counted per runner).
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

    // Per-runner counts for the listed orders, and totals for the whole event (paid orders only).
    const paidIds = await Order.find({ event_id: event._id, status: 'paid' }).distinct('_id');
    const [perOrder, [runnerTotals], [orderTotals]] = await Promise.all([
      Participant.aggregate([
        { $match: { order_id: { $in: orders.map((o) => o._id) } } },
        {
          $group: {
            _id: '$order_id',
            kit: { $sum: { $cond: ['$kit_collected', 1, 0] } },
            checkin: { $sum: { $cond: ['$checked_in', 1, 0] } },
          },
        },
      ]),
      Participant.aggregate([
        { $match: { order_id: { $in: paidIds } } },
        {
          $group: {
            _id: null,
            runners: { $sum: 1 },
            kits_collected_runners: { $sum: { $cond: ['$kit_collected', 1, 0] } },
            checked_in_runners: { $sum: { $cond: ['$checked_in', 1, 0] } },
          },
        },
      ]),
      Order.aggregate([
        { $match: { _id: { $in: paidIds } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            kits_collected_orders: { $sum: { $cond: ['$kit_collected', 1, 0] } },
            checked_in_orders: { $sum: { $cond: ['$checked_in', 1, 0] } },
          },
        },
      ]),
    ]);
    const countsBy = new Map(perOrder.map((c) => [String(c._id), c]));

    res.json({
      event: { _id: event._id, event_name: event.event_name, date: event.date },
      results: orders.map((o) => {
        const c = countsBy.get(String(o._id)) || { kit: 0, checkin: 0 };
        return {
          order_no: o.order_no,
          type: o.type,
          group_name: o.group_name,
          buyer_name: o.user_id?.name,
          participant_count: o.participant_count,
          race_category: o.race_category,
          status: o.status === 'pending' && o.expires_at <= now ? 'expired' : o.status,
          kit_collected: o.kit_collected,
          kit_collected_count: c.kit,
          checked_in: o.checked_in,
          checked_in_count: c.checkin,
          matched_member: matchedMember.get(String(o._id)),
        };
      }),
      totals: {
        orders: orderTotals?.orders || 0,
        runners: runnerTotals?.runners || 0,
        kits_collected_orders: orderTotals?.kits_collected_orders || 0,
        kits_collected_runners: runnerTotals?.kits_collected_runners || 0,
        checked_in_orders: orderTotals?.checked_in_orders || 0,
        checked_in_runners: runnerTotals?.checked_in_runners || 0,
      },
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
