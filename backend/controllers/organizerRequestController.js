// "Request organizer access": participants ask, admins approve or reject.
const mongoose = require('mongoose');
const User = require('../models/User');
const OrganizerRequest = require('../models/OrganizerRequest');
const { createNotification } = require('./notificationController');
const { sendEmail } = require('../utils/email');
const { roleChangedEmail, organizerRequestEmail, organizerRequestDeclinedEmail } = require('../utils/emailTemplates');

const clean = (v, max) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, max);

const requestJson = (r) => ({
  _id: r._id,
  organization: r.organization,
  note: r.note,
  status: r.status,
  createdAt: r.createdAt,
  decided_at: r.decided_at,
  decision_reason: r.decision_reason,
});

// Best-effort side effects: never fail the request because a notification/email failed.
async function quietly(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`[organizer requests] ${label} failed:`, err.message);
  }
}

// POST /api/organizer-requests  { organization, note? }   (participants only)
const createRequest = async (req, res) => {
  try {
    if (req.user.role !== 'participant') {
      return res.status(400).json({ message: 'Only participant accounts can request organizer access' });
    }
    const organization = clean(req.body?.organization, 100);
    const note = clean(req.body?.note, 500);
    if (!organization) {
      return res.status(400).json({ message: 'Please enter your organisation or group name' });
    }

    let request;
    try {
      request = await OrganizerRequest.create({ user_id: req.user.userId, organization, note: note || undefined });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'You already have a request waiting for the admin' });
      throw err;
    }

    // Tell the admins (in-app + email).
    const [user, admins] = await Promise.all([User.findById(req.user.userId), User.find({ role: 'admin' })]);
    for (const admin of admins) {
      await quietly('admin notification', () =>
        createNotification(
          admin._id,
          'organizer_request',
          'New organizer request',
          `${user.name} (${organization}) wants to become an organizer`,
          `${user.name} (${user.email}) asked for organizer access.\n\nOrganisation: ${organization}` +
            (note ? `\nNote: ${note}` : '') +
            '\n\nReview it in Users → Requests.',
          { participantId: user._id }
        )
      );
      await quietly('admin email', () => sendEmail({ to: admin.email, ...organizerRequestEmail({ admin, user, organization, note }) }));
    }

    res.status(201).json({ message: 'Request sent. The admin will review it.', request: requestJson(request) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send request', error: error.message });
  }
};

// GET /api/organizer-requests/mine → the user's latest request (or null)
const getMyRequest = async (req, res) => {
  try {
    const request = await OrganizerRequest.findOne({ user_id: req.user.userId, status: { $ne: 'cancelled' } }).sort({
      createdAt: -1,
    });
    res.json({ request: request ? requestJson(request) : null });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load request', error: error.message });
  }
};

// DELETE /api/organizer-requests/mine → withdraw a pending request
const cancelMyRequest = async (req, res) => {
  try {
    const r = await OrganizerRequest.findOneAndUpdate(
      { user_id: req.user.userId, status: 'pending' },
      { status: 'cancelled' },
      { new: true }
    );
    if (!r) return res.status(404).json({ message: 'No pending request to withdraw' });
    res.json({ message: 'Request withdrawn' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to withdraw request', error: error.message });
  }
};

// ---- Admin ----------------------------------------------------------------------------

// GET /api/admin/organizer-requests?status=pending|approved|rejected  (default pending)
const listRequests = async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const requests = await OrganizerRequest.find({ status })
      .sort({ createdAt: status === 'pending' ? 1 : -1 })
      .limit(200)
      .populate('user_id', 'name email phone_no role createdAt')
      .populate('decided_by', 'name');
    const pendingCount = await OrganizerRequest.countDocuments({ status: 'pending' });
    res.json({
      pending_count: pendingCount,
      requests: requests.map((r) => ({
        ...requestJson(r),
        user: r.user_id,
        decided_by: r.decided_by?.name,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load requests', error: error.message });
  }
};

// Atomically takes a pending request for a decision; null if already decided/withdrawn.
const claim = (id, adminId, update) =>
  OrganizerRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { ...update, decided_by: adminId, decided_at: new Date() } },
    { new: true }
  );

// POST /api/admin/organizer-requests/:id/approve
const approveRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Request not found' });
    const r = await claim(req.params.id, req.user.userId, { status: 'approved' });
    if (!r) return res.status(409).json({ message: 'This request was already handled or withdrawn' });

    const user = await User.findById(r.user_id);
    if (!user) return res.status(404).json({ message: 'The user no longer exists' });
    const previous = user.role;
    if (user.role === 'participant') {
      user.role = 'organizer';
      await user.save();
    }

    await quietly('user notification', () =>
      createNotification(
        user._id,
        'role_changed',
        "You're now an organizer",
        'Your request was approved. You can now create and run events.',
        'Your request for organizer access was approved. Open My Events to create your first event.',
        {}
      )
    );
    await quietly('user email', () => sendEmail({ to: user.email, ...roleChangedEmail({ user, role: 'organizer', previous }) }));

    res.json({ message: `${user.name} is now an organizer`, request: requestJson(r) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve request', error: error.message });
  }
};

// POST /api/admin/organizer-requests/:id/reject  { reason? }
const rejectRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Request not found' });
    const reason = clean(req.body?.reason, 500);
    const r = await claim(req.params.id, req.user.userId, { status: 'rejected', decision_reason: reason || undefined });
    if (!r) return res.status(409).json({ message: 'This request was already handled or withdrawn' });

    const user = await User.findById(r.user_id);
    if (user) {
      await quietly('user notification', () =>
        createNotification(
          user._id,
          'role_changed',
          'Organizer request declined',
          reason ? `Your organizer request was declined: ${reason}` : 'Your organizer request was declined.',
          `Your request for organizer access (${r.organization}) was declined.` +
            (reason ? `\n\nReason: ${reason}` : '') +
            '\n\nYou can send a new request from your Profile.',
          {}
        )
      );
      await quietly('user email', () =>
        sendEmail({ to: user.email, ...organizerRequestDeclinedEmail({ user, organization: r.organization, reason }) })
      );
    }
    res.json({ message: 'Request declined', request: requestJson(r) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to decline request', error: error.message });
  }
};

module.exports = { createRequest, getMyRequest, cancelMyRequest, listRequests, approveRequest, rejectRequest };
