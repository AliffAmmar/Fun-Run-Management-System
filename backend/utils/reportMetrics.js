// Event report metrics (partner's report module), computed from Order + Participant + Payment.
// Output keys are unchanged from the Registration/Ticket version so the report page, CSV and PDF
// exports keep working. Differences in meaning:
//   - a "registration" is now an Order (individual or group); by_registration_type keys are
//     'individual' and 'group' (was 'team');
//   - participants / shirt sizes / check-ins count only PAID orders;
//   - payments: an order can have several attempts (e.g. failed then success), all are counted.
// Added (new keys, nothing removed): kit_collected_participants, kit_collection_rate.
// Kit collection and check-in are counted PER RUNNER (ticked individually on the check-in page).
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Payment = require('../models/Payment');

// Every category of the event is listed (with its own capacity), even before anyone registers.
const categoryStart = (event) =>
  Object.fromEntries(
    (event.categories || []).map((c) => [c.name, { participants: 0, revenue: 0, capacity: c.capacity || null }])
  );

const emptyMetrics = (event) => ({
  registration_count: 0,
  total_participants: 0,
  total_revenue: 0,
  payment_counts: { pending: 0, failed: 0, refunded: 0 },
  breakdowns: {
    by_race_category: categoryStart(event),
    by_registration_type: {},
    by_payment_method: {},
    by_shirt_size: {},
    registrations_per_day: [],
  },
  capacity_utilization: 0,
  checked_in_participants: 0,
  attendance_rate: 0,
  kit_collected_participants: 0,
  kit_collection_rate: 0,
  capacity: event.capacity,
});

const getEventReportMetrics = async (eventId, event) => {
  const eventObjectId = new mongoose.Types.ObjectId(String(eventId));
  const orders = await Order.find({ event_id: eventObjectId })
    .select('type race_category participant_count status kit_collected checked_in createdAt')
    .lean();

  const metrics = emptyMetrics(event);
  if (orders.length === 0) return metrics;

  const orderIds = orders.map((o) => o._id);
  const paidIds = orders.filter((o) => o.status === 'paid').map((o) => o._id);

  const [payments, shirtCounts] = await Promise.all([
    Payment.find({ order_id: { $in: orderIds } }).select('order_id amount payment_method payment_status').lean(),
    Participant.aggregate([
      { $match: { order_id: { $in: paidIds } } },
      {
        $group: {
          _id: '$shirt_size',
          count: { $sum: 1 },
          kit: { $sum: { $cond: ['$kit_collected', 1, 0] } },
          checkin: { $sum: { $cond: ['$checked_in', 1, 0] } },
        },
      },
    ]),
  ]);

  const categoryBreakdowns = metrics.breakdowns.by_race_category;
  const typeBreakdowns = metrics.breakdowns.by_registration_type;
  const methodBreakdowns = metrics.breakdowns.by_payment_method;
  const dailyCounts = new Map();
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  metrics.registration_count = orders.length;

  for (const order of orders) {
    const category = order.race_category || 'Unspecified';
    const type = order.type || 'Unspecified';
    const runners = Number(order.participant_count) || 1;

    categoryBreakdowns[category] = categoryBreakdowns[category] || { participants: 0, revenue: 0, capacity: null };
    typeBreakdowns[type] = typeBreakdowns[type] || { registrations: 0, participants: 0, revenue: 0 };
    typeBreakdowns[type].registrations += 1;

    if (order.status === 'paid') {
      metrics.total_participants += runners;
      categoryBreakdowns[category].participants += runners;
      typeBreakdowns[type].participants += runners;
    }

    if (order.createdAt) {
      const day = new Date(order.createdAt).toISOString().slice(0, 10);
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }
  }

  for (const payment of payments) {
    const amount = Number(payment.amount) || 0;
    const method = payment.payment_method || 'unspecified';
    methodBreakdowns[method] = methodBreakdowns[method] || { payments: 0, amount: 0, status_counts: {} };
    methodBreakdowns[method].payments += 1;
    methodBreakdowns[method].status_counts[payment.payment_status] =
      (methodBreakdowns[method].status_counts[payment.payment_status] || 0) + 1;

    if (payment.payment_status === 'success') {
      metrics.total_revenue += amount;
      methodBreakdowns[method].amount += amount;
      const order = orderById.get(String(payment.order_id));
      if (order) {
        categoryBreakdowns[order.race_category || 'Unspecified'].revenue += amount;
        typeBreakdowns[order.type || 'Unspecified'].revenue += amount;
      }
    }
    if (Object.prototype.hasOwnProperty.call(metrics.payment_counts, payment.payment_status)) {
      metrics.payment_counts[payment.payment_status] += 1;
    }
  }

  for (const { _id: size, count, kit, checkin } of shirtCounts) {
    metrics.breakdowns.by_shirt_size[size] = count;
    metrics.kit_collected_participants += kit;
    metrics.checked_in_participants += checkin;
  }

  metrics.breakdowns.registrations_per_day = Array.from(dailyCounts, ([date, count]) => ({ date, count }))
    .sort((left, right) => left.date.localeCompare(right.date));
  metrics.capacity_utilization = Number(event.capacity) > 0 ? metrics.total_participants / event.capacity : 0;
  metrics.attendance_rate = metrics.total_participants > 0
    ? metrics.checked_in_participants / metrics.total_participants
    : 0;
  metrics.kit_collection_rate = metrics.total_participants > 0
    ? metrics.kit_collected_participants / metrics.total_participants
    : 0;

  return metrics;
};

const findEventOrNull = (eventId) => Event.findById(eventId);

module.exports = { getEventReportMetrics, findEventOrNull };
