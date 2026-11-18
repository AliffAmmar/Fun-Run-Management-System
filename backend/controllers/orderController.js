// Registration in the Order + Participant model.
// An individual registration = an Order with 1 Participant; a group = an Order with 2–200.
// Replaces registrationController once the frontend has switched over.
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const Certificate = require('../models/Certificate');
const { nextOrderNo } = require('../utils/numbering');
const { validateParticipants, findDuplicateEmailWarnings } = require('../utils/orderValidation');
const { editDeadline } = require('../utils/editWindow');

const isAdmin = (user) => user.role === 'admin';
const isEventOrganizer = (event, user) =>
  Boolean(event) && user.role === 'organizer' && String(event.organizer_id) === String(user.userId);
const isBuyer = (order, user) => String(order.user_id?._id || order.user_id) === String(user.userId);

// Shirt-size totals derived from the participant rows (never entered separately).
function shirtSizeBreakdown(participants) {
  const counts = Object.fromEntries(Participant.SHIRT_SIZES.map((s) => [s, 0]));
  participants.forEach((p) => {
    counts[p.shirt_size] += 1;
  });
  return counts;
}

// Adds `participants` and `shirt_sizes` to each order (one query for all orders).
async function withParticipants(orders) {
  const list = Array.isArray(orders) ? orders : [orders];
  const participants = await Participant.find({ order_id: { $in: list.map((o) => o._id) } })
    .sort({ bib_number: 1, _id: 1 })
    .lean();
  // Certificates (after the event is completed): number + status per participant.
  const certs = await Certificate.find({ participant_id: { $in: participants.map((p) => p._id) } })
    .select('participant_id certificate_no status')
    .lean();
  const certByParticipant = new Map(certs.map((c) => [String(c.participant_id), c]));
  participants.forEach((p) => {
    const c = certByParticipant.get(String(p._id));
    if (c) {
      p.certificate_no = c.certificate_no;
      p.certificate_status = c.status;
    }
  });

  const byOrder = new Map();
  participants.forEach((p) => {
    const key = String(p.order_id);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key).push(p);
  });

  const result = list.map((o) => {
    const obj = o.toObject ? o.toObject() : o;
    const ps = byOrder.get(String(o._id)) || [];
    const ev = obj.event_id && obj.event_id.date ? obj.event_id : null;
    return {
      ...obj,
      // Until when the buyer may still edit runner names / shirt sizes (null if event not loaded).
      edit_until: ev ? editDeadline(ev) : null,
      is_expired: obj.status === 'pending' && new Date(obj.expires_at) <= new Date(),
      participants: ps,
      shirt_sizes: shirtSizeBreakdown(ps),
    };
  });
  return Array.isArray(orders) ? result : result[0];
}

// POST /api/orders
// Body: { event_id, type: 'individual'|'group', race_category, group_name?, emergency_contact,
//         consent_given?, participants: [{ name, email?, shirt_size, emergency_contact? }] }
// Any amount sent by the client is ignored: total = category price × number of participants.
const createOrder = async (req, res) => {
  try {
    const { event_id, type, race_category, group_name, emergency_contact, consent_given, participants: rows } =
      req.body;

    // ---- Event checks ----------------------------------------------------------
    if (!mongoose.isValidObjectId(event_id)) {
      return res.status(400).json({ message: 'A valid event_id is required' });
    }
    const event = await Event.findById(event_id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.status !== 'published') {
      return res.status(400).json({ message: 'This event is not open for registration' });
    }
    if (event.date <= new Date()) {
      return res.status(400).json({ message: 'This event has already taken place' });
    }

    const category = event.categories.find((c) => c.name === race_category);
    if (!category) {
      return res.status(400).json({ message: `Invalid race category for this event: ${race_category}` });
    }

    // ---- Order-level checks ----------------------------------------------------
    if (!['individual', 'group'].includes(type)) {
      return res.status(400).json({ message: "type must be 'individual' or 'group'" });
    }
    if (!emergency_contact || !String(emergency_contact).trim()) {
      return res.status(400).json({ message: 'Emergency contact is required' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'At least one participant is required' });
    }

    if (type === 'individual' && rows.length !== 1) {
      return res.status(400).json({ message: 'An individual registration has exactly 1 participant' });
    }
    if (type === 'group') {
      if (!group_name || !String(group_name).trim()) {
        return res.status(400).json({ message: 'Group name is required' });
      }
      if (rows.length < 2) {
        return res.status(400).json({ message: 'A group needs at least 2 participants' });
      }
      if (rows.length > Order.MAX_GROUP_SIZE) {
        return res.status(400).json({
          message: `A group can have at most ${Order.MAX_GROUP_SIZE} participants (got ${rows.length})`,
        });
      }
      if (consent_given !== true) {
        return res.status(400).json({
          message: 'Please confirm that all members agreed to share their details',
        });
      }
    }

    // ---- Participant rows --------------------------------------------------------
    const { participants, errors } = validateParticipants(rows);
    if (errors.length > 0) {
      return res.status(400).json({
        message: `${errors.length} problem(s) in the participant list`,
        errors,
      });
    }

    // One active individual registration per account per event (cancelled/expired don't count).
    if (type === 'individual') {
      const now = new Date();
      const existing = await Order.findOne({
        user_id: req.user.userId,
        event_id,
        type: 'individual',
        $or: [{ status: 'paid' }, { status: 'pending', expires_at: { $gt: now } }],
      });
      if (existing) {
        return res.status(409).json({
          message:
            existing.status === 'paid'
              ? 'You are already registered for this event'
              : 'You already have an unpaid registration for this event. Please complete its payment.',
          order_no: existing.order_no,
        });
      }
    }

    // ---- Capacity (counted per participant) --------------------------------------
    const held = await Order.countHeldParticipants(event._id);
    const remaining = event.capacity - held;
    if (participants.length > remaining) {
      return res.status(409).json({
        message:
          remaining <= 0
            ? 'Sorry, this event is sold out'
            : `Only ${remaining} slot(s) left, but this registration has ${participants.length} participants`,
        remaining: Math.max(remaining, 0),
      });
    }

    const warnings = await findDuplicateEmailWarnings(event._id, participants);

    // ---- Create ------------------------------------------------------------------
    const order = await Order.create({
      order_no: await nextOrderNo(),
      user_id: req.user.userId,
      event_id: event._id,
      type,
      group_name: type === 'group' ? String(group_name).trim() : undefined,
      race_category,
      participant_count: participants.length,
      total_amount: category.price * participants.length,
      emergency_contact: String(emergency_contact).trim(),
      consent_given: type === 'group' ? true : Boolean(consent_given),
      status: 'pending',
    });

    try {
      await Participant.insertMany(
        participants.map((p) => ({ ...p, order_id: order._id, event_id: event._id }))
      );
    } catch (err) {
      await Order.deleteOne({ _id: order._id });
      throw err;
    }

    // Two registrations at the same moment could both pass the capacity check above.
    // Re-count now that ours is saved; if the event is over capacity, withdraw ours.
    // (Never overbooks; in a rare tie both may be asked to try again.)
    if ((await Order.countHeldParticipants(event._id)) > event.capacity) {
      await Participant.deleteMany({ order_id: order._id });
      await Order.deleteOne({ _id: order._id });
      return res.status(409).json({ message: 'The last slots were just taken. Please try again.' });
    }

    res.status(201).json({
      message: 'Registration created. Please complete payment to confirm it.',
      order: await withParticipants(order),
      warnings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create registration', error: error.message });
  }
};

// GET /api/orders/my-orders: the logged-in buyer's orders, newest first.
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user_id: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('event_id', 'event_name date location status categories kit_cutoff_date');
    res.json({ orders: await withParticipants(orders) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get registrations', error: error.message });
  }
};

// GET /api/orders/:order_no: the buyer, that event's organizer, or an admin.
const getOrderByNo = async (req, res) => {
  try {
    const order = await Order.findOne({ order_no: req.params.order_no })
      .populate('event_id', 'event_name date location status organizer_id categories kit_cutoff_date')
      .populate('user_id', 'name email phone_no');
    if (!order) return res.status(404).json({ message: 'Registration not found' });

    if (!isBuyer(order, req.user) && !isEventOrganizer(order.event_id, req.user) && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to view this registration' });
    }

    res.json({ order: await withParticipants(order) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get registration', error: error.message });
  }
};

// DELETE /api/orders/:order_no: the buyer (or admin) cancels an UNPAID order.
// Cancelling a paid order (refunds) is out of scope; the organizer handles it manually.
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ order_no: req.params.order_no });
    if (!order) return res.status(404).json({ message: 'Registration not found' });

    if (!isBuyer(order, req.user) && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to cancel this registration' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({
        message:
          order.status === 'paid'
            ? 'A paid registration cannot be cancelled online. Please contact the organizer.'
            : 'This registration is already cancelled',
      });
    }

    order.status = 'cancelled';
    await order.save();
    res.json({ message: 'Registration cancelled', order });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel registration', error: error.message });
  }
};

// GET /api/orders/event/:event_id: that event's organizer or an admin.
// All orders for the event with participants, plus totals.
const getOrdersByEvent = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.event_id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    const event = await Event.findById(req.params.event_id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOrganizer(event, req.user) && !isAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const orders = await Order.find({ event_id: event._id })
      .sort({ createdAt: -1 })
      .populate('user_id', 'name email phone_no');
    const held = await Order.countHeldParticipants(event._id);

    res.json({
      orders: await withParticipants(orders),
      capacity: event.capacity,
      held_slots: held,
      remaining: Math.max(event.capacity - held, 0),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get registrations', error: error.message });
  }
};

// PATCH /api/orders/:order_no/participants/:participantId   { name?, shirt_size? }
// Correct a runner's name or shirt size after registering (no adding/removing runners).
//   buyer:              until the kit preparation cutoff (default 7 days before the event), and
//                       shirt size only while the kits are not yet collected
//   organizer / admin:  any time (e.g. fixing a name at the counter)
const updateParticipant = async (req, res) => {
  try {
    const order = await Order.findOne({ order_no: req.params.order_no });
    if (!order) return res.status(404).json({ message: 'Registration not found' });
    const event = await Event.findById(order.event_id);
    const staff = isAdmin(req.user) || isEventOrganizer(event, req.user);
    if (!staff && !isBuyer(order, req.user)) {
      return res.status(403).json({ message: 'Not authorized to edit this registration' });
    }

    const expired = order.status === 'pending' && order.expires_at <= new Date();
    if (order.status === 'cancelled' || expired) {
      return res.status(400).json({ message: 'This registration is no longer active' });
    }

    if (!mongoose.isValidObjectId(req.params.participantId)) {
      return res.status(404).json({ message: 'Runner not found in this registration' });
    }
    const participant = await Participant.findOne({ _id: req.params.participantId, order_id: order._id });
    if (!participant) return res.status(404).json({ message: 'Runner not found in this registration' });

    const { name, shirt_size } = req.body || {};
    if (name === undefined && shirt_size === undefined) {
      return res.status(400).json({ message: 'Nothing to change' });
    }

    if (!staff) {
      const deadline = editDeadline(event);
      if (new Date() > deadline) {
        return res.status(403).json({
          message: `Changes closed on ${deadline.toLocaleDateString('en-MY', { dateStyle: 'long' })}. Please contact the organizer.`,
        });
      }
      if (shirt_size !== undefined && participant.kit_collected) {
        return res.status(400).json({ message: 'This runner already collected their kit, so the shirt size can no longer change' });
      }
    }

    // Same rules as at registration.
    const { participants, errors } = validateParticipants([
      { name: name !== undefined ? name : participant.name, shirt_size: shirt_size !== undefined ? shirt_size : participant.shirt_size },
    ]);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.map((e) => e.message.replace(/^Row 1: /, '')).join('. '), errors });
    }
    participant.name = participants[0].name;
    participant.shirt_size = participants[0].shirt_size;
    await participant.save();

    const updated = await Order.findById(order._id).populate(
      'event_id',
      'event_name date location status categories kit_cutoff_date'
    );
    res.json({ message: 'Runner updated', order: await withParticipants(updated) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update runner', error: error.message });
  }
};

module.exports = { createOrder, getMyOrders, getOrderByNo, cancelOrder, getOrdersByEvent, updateParticipant };
