const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

const emptyMetrics = (event) => ({
  registration_count: 0,
  total_participants: 0,
  total_revenue: 0,
  payment_counts: { pending: 0, failed: 0, refunded: 0 },
  breakdowns: {
    by_race_category: {},
    by_registration_type: {},
    by_payment_method: {},
    by_shirt_size: {},
    registrations_per_day: [],
  },
  capacity_utilization: 0,
  checked_in_participants: 0,
  attendance_rate: 0,
  capacity: event.capacity,
});

const getEventReportMetrics = async (eventId, event) => {
  const registrations = await Registration.aggregate([
    { $match: { event_id: new mongoose.Types.ObjectId(eventId) } },
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'registration_id',
        as: 'payments',
      },
    },
    {
      $lookup: {
        from: 'tickets',
        localField: '_id',
        foreignField: 'registration_id',
        as: 'tickets',
      },
    },
    {
      $project: {
        registration_type: 1,
        race_category: 1,
        team_size: 1,
        shirt_size: 1,
        registration_status: 1,
        createdAt: 1,
        team_shirt_sizes: { $objectToArray: { $ifNull: ['$shirt_sizes', {}] } },
        payments: 1,
        tickets: 1,
      },
    },
  ]);

  if (registrations.length === 0) {
    return emptyMetrics(event);
  }

  const metrics = emptyMetrics(event);
  const categoryBreakdowns = metrics.breakdowns.by_race_category;
  const typeBreakdowns = metrics.breakdowns.by_registration_type;
  const methodBreakdowns = metrics.breakdowns.by_payment_method;
  const shirtBreakdowns = metrics.breakdowns.by_shirt_size;
  const dailyCounts = new Map();

  metrics.registration_count = registrations.length;

  for (const registration of registrations) {
    const teamSize = Number(registration.team_size) || 1;
    const confirmed = registration.registration_status === 'confirmed';
    const payment = registration.payments[0];
    const successfulAmount = payment?.payment_status === 'success' ? Number(payment.amount) || 0 : 0;
    const category = registration.race_category || 'Unspecified';
    const registrationType = registration.registration_type || 'Unspecified';

    if (!categoryBreakdowns[category]) {
      categoryBreakdowns[category] = { participants: 0, revenue: 0 };
    }
    if (!typeBreakdowns[registrationType]) {
      typeBreakdowns[registrationType] = { registrations: 0, participants: 0, revenue: 0 };
    }

    typeBreakdowns[registrationType].registrations += 1;
    categoryBreakdowns[category].revenue += successfulAmount;
    typeBreakdowns[registrationType].revenue += successfulAmount;

    if (confirmed) {
      metrics.total_participants += teamSize;
      categoryBreakdowns[category].participants += teamSize;
      typeBreakdowns[registrationType].participants += teamSize;

      if (registration.registration_type === 'individual' && registration.shirt_size) {
        shirtBreakdowns[registration.shirt_size] = (shirtBreakdowns[registration.shirt_size] || 0) + 1;
      }
      for (const shirtSize of registration.team_shirt_sizes || []) {
        shirtBreakdowns[shirtSize.k] = (shirtBreakdowns[shirtSize.k] || 0) + (Number(shirtSize.v) || 0);
      }
    }

    if (payment) {
      const method = payment.payment_method || 'unspecified';
      if (!methodBreakdowns[method]) {
        methodBreakdowns[method] = { payments: 0, amount: 0, status_counts: {} };
      }
      methodBreakdowns[method].payments += 1;
      methodBreakdowns[method].status_counts[payment.payment_status] =
        (methodBreakdowns[method].status_counts[payment.payment_status] || 0) + 1;
      if (payment.payment_status === 'success') {
        metrics.total_revenue += Number(payment.amount) || 0;
        methodBreakdowns[method].amount += Number(payment.amount) || 0;
      }
      if (Object.prototype.hasOwnProperty.call(metrics.payment_counts, payment.payment_status)) {
        metrics.payment_counts[payment.payment_status] += 1;
      }
    }

    if (registration.createdAt) {
      const day = new Date(registration.createdAt).toISOString().slice(0, 10);
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }

    const ticket = registration.tickets.find((item) => item.check_in_status);
    if (ticket) {
      metrics.checked_in_participants += Number(ticket.team_size) || teamSize;
    }
  }

  metrics.breakdowns.registrations_per_day = Array.from(dailyCounts, ([date, count]) => ({ date, count }))
    .sort((left, right) => left.date.localeCompare(right.date));
  metrics.capacity_utilization = Number(event.capacity) > 0 ? metrics.total_participants / event.capacity : 0;
  metrics.attendance_rate = metrics.total_participants > 0
    ? metrics.checked_in_participants / metrics.total_participants
    : 0;

  return metrics;
};

const findEventOrNull = (eventId) => Event.findById(eventId);

module.exports = { getEventReportMetrics, findEventOrNull };