const mongoose = require('mongoose');

// One Order = one purchase / invoice / QR code. An individual registration is an Order
// with 1 Participant; a group registration is an Order with 2–200 Participants.
// Runner details (name, email, shirt size, bib) live on Participant, linked by order_id.

const MAX_GROUP_SIZE = 200;
const HOLD_MINUTES = 30; // how long a pending (unpaid) order holds its slots

const orderSchema = new mongoose.Schema(
  {
    order_no: {
      type: String,
      required: true,
      unique: true, // e.g. FR-1042, see utils/numbering.js
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true, // the buyer; may or may not be one of the runners
    },
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    type: {
      type: String,
      enum: ['individual', 'group'],
      required: true,
    },
    group_name: {
      type: String,
      trim: true,
      required: function () {
        return this.type === 'group';
      },
    },
    race_category: {
      type: String,
      enum: ['1km', '3km', '5km', '10km'],
      required: true, // one category per order, no mixing
    },
    participant_count: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_GROUP_SIZE,
      validate: {
        validator: function (n) {
          return this.type === 'individual' ? n === 1 : n >= 2;
        },
        message: 'An individual order has 1 participant; a group has at least 2',
      },
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0, // always computed by the server: category price × participant_count
    },
    emergency_contact: {
      type: String,
      trim: true, // group default; a Participant may override it
    },
    consent_given: {
      type: Boolean,
      default: false, // PDPA: buyer confirms members agreed to share their details
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },
    // A pending order past this time is treated as expired: it no longer holds slots.
    // No cron job needed; queries simply ignore it.
    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
    },
    paid_at: Date,

    // Kit collection (order-level: the leader collects all kits at once)
    kit_collected: { type: Boolean, default: false },
    kit_collected_at: Date,
    kit_collected_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Event-day check-in (order-level)
    checked_in: { type: Boolean, default: false },
    checked_in_at: Date,
    checked_in_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Set once the buyer has been emailed "certificates are ready in My Tickets" (for members
    // without an email). Guarantees one notice per order.
    certificates_notice_sent_at: Date,
  },
  { timestamps: true }
);

orderSchema.index({ event_id: 1, status: 1 });
orderSchema.index({ user_id: 1 });

// True if this order currently takes up slots (paid, or pending and not yet expired).
orderSchema.methods.holdsSlots = function (now = new Date()) {
  return this.status === 'paid' || (this.status === 'pending' && this.expires_at > now);
};

// Number of runners currently taking up slots for an event:
// participants in paid orders + participants in unexpired pending orders.
// Remaining capacity = event.capacity − this.
orderSchema.statics.countHeldParticipants = async function (eventId, now = new Date()) {
  const [result] = await this.aggregate([
    {
      $match: {
        event_id: new mongoose.Types.ObjectId(String(eventId)),
        $or: [{ status: 'paid' }, { status: 'pending', expires_at: { $gt: now } }],
      },
    },
    { $group: { _id: null, total: { $sum: '$participant_count' } } },
  ]);
  return result ? result.total : 0;
};

orderSchema.statics.MAX_GROUP_SIZE = MAX_GROUP_SIZE;
orderSchema.statics.HOLD_MINUTES = HOLD_MINUTES;

module.exports = mongoose.model('Order', orderSchema);
