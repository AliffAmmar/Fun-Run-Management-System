// What happens when an order is paid. Called by the mock payment endpoint and (later) by the
// Stripe webhook, so there is exactly one place that "confirms" a registration.
//
// Idempotent: Stripe may deliver the same webhook more than once, and a user may double-click.
// Only the call that actually moves the order from pending → paid does the follow-up work, so a
// second call never assigns more bibs or sends more notifications.
const Order = require('../models/Order');
const Event = require('../models/Event');
const User = require('../models/User');
const Participant = require('../models/Participant');
const { sendEmail } = require('./email');
const { orderConfirmationEmail } = require('./emailTemplates');
const { assignBibNumbers } = require('./numbering');
const { createNotification } = require('../controllers/notificationController');

// Returns { order, alreadyPaid } on success, or { error } if the order can't be fulfilled.
async function fulfilOrder(orderId) {
  // Atomic pending → paid. If two calls race, only one gets a document back.
  // An EXPIRED pending order is still fulfilled: the money was taken, so honour it.
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: 'pending' },
    { $set: { status: 'paid', paid_at: new Date() } },
    { new: true }
  );

  if (!order) {
    const existing = await Order.findById(orderId);
    if (!existing) return { error: 'Order not found' };
    if (existing.status === 'paid') return { order: existing, alreadyPaid: true };
    return { error: `Order is ${existing.status}` };
  }

  await assignBibNumbers(order);

  // Notifications must never undo a payment, so failures are only logged.
  try {
    await notifyPaid(order);
  } catch (err) {
    console.error(`Notifications failed for ${order.order_no}:`, err.message);
  }

  // Confirmation email to the buyer (QR + bibs). Like notifications, a failed email never
  // undoes the payment; the order and QR are always available in My Tickets.
  try {
    await sendConfirmationEmail(order);
  } catch (err) {
    console.error(`Confirmation email failed for ${order.order_no}:`, err.message);
  }

  return { order, alreadyPaid: false };
}

// Moved here from paymentController (partner's code) so it fires once per paid order.
async function notifyPaid(order) {
  const [event, buyer] = await Promise.all([Event.findById(order.event_id), User.findById(order.user_id)]);
  if (!event || !buyer) return;

  const date = new Date(event.date).toLocaleDateString('en-MY');
  const who =
    order.type === 'group'
      ? `${order.group_name} (${order.participant_count} runners)`
      : buyer.name;
  // relatedData only has fixed fields (Notification model); the order number is in the text.
  const related = { eventId: event._id, participantId: order.user_id };

  await createNotification(
    order.user_id,
    'registration_confirmed',
    'Registration Confirmed',
    `Your registration ${order.order_no} for ${event.event_name} is confirmed!`,
    `Your registration for ${event.event_name} has been confirmed.\n\n` +
      `Order: ${order.order_no}\n` +
      (order.type === 'group' ? `Group: ${order.group_name} (${order.participant_count} runners)\n` : '') +
      `Race Category: ${order.race_category}\n- Date: ${date}\n- Location: ${event.location}\n\n` +
      'Your QR code and bib numbers are in My Tickets. Get ready for an amazing run!',
    related
  );

  await createNotification(
    event.organizer_id,
    'participant_joined',
    'New Participant Registration',
    `${who} joined ${event.event_name}`,
    `A new registration has been paid for your event.\n\n` +
      `Order: ${order.order_no}\nRegistered by: ${buyer.name}\n` +
      (order.type === 'group' ? `Group: ${order.group_name}\nRunners: ${order.participant_count}\n` : '') +
      `Event: ${event.event_name}\nRace Category: ${order.race_category}`,
    { ...related, organizerId: event.organizer_id }
  );
}

async function sendConfirmationEmail(order) {
  const [event, buyer, participants] = await Promise.all([
    Event.findById(order.event_id),
    User.findById(order.user_id),
    Participant.find({ order_id: order._id }).sort({ bib_number: 1 }),
  ]);
  if (!event || !buyer?.email) return;
  const email = await orderConfirmationEmail({ order, event, buyer, participants });
  await sendEmail({ to: buyer.email, ...email });
}

module.exports = { fulfilOrder };
