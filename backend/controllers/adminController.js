// Admin-only user management (routes/admin.js applies requireRole('admin')).
// Admins can make a user an organizer or a participant. They cannot change admins (including
// themselves): the first admin is created with scripts/setRole.js.
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const { escapeRegex } = require('../utils/regex');
const { sendEmail } = require('../utils/email');
const { roleChangedEmail } = require('../utils/emailTemplates');

const ASSIGNABLE_ROLES = ['participant', 'organizer'];
const PAGE_SIZE = 50;

// GET /api/admin/users?q=&role=&page=
const listUsers = async (req, res) => {
  try {
    const filter = {};
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }
    if (['participant', 'organizer', 'admin'].includes(req.query.role)) filter.role = req.query.role;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email phone_no role createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      User.countDocuments(filter),
    ]);
    const eventCounts = await Event.aggregate([
      { $match: { organizer_id: { $in: users.map((u) => u._id) } } },
      { $group: { _id: '$organizer_id', n: { $sum: 1 } } },
    ]);
    const countBy = new Map(eventCounts.map((e) => [String(e._id), e.n]));

    res.json({
      users: users.map((u) => ({ ...u, event_count: countBy.get(String(u._id)) || 0 })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load users', error: error.message });
  }
};

// PATCH /api/admin/users/:id/role   { role: 'participant' | 'organizer' }
const setUserRole = async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Role must be participant or organizer' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'User not found' });
    if (String(req.params.id) === String(req.user.userId)) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ message: "Admins can't be changed here" });
    }
    if (user.role === role) {
      return res.json({ message: `${user.name} is already ${role === 'organizer' ? 'an organizer' : 'a participant'}`, user });
    }

    const previous = user.role;
    user.role = role;
    await user.save();

    // Takes effect immediately (the server reads the role on every request). Tell the user.
    try {
      await sendEmail({ to: user.email, ...roleChangedEmail({ user, role, previous }) });
    } catch (err) {
      console.error('Role change email failed:', err.message);
    }

    const eventCount = await Event.countDocuments({ organizer_id: user._id });
    res.json({
      message:
        role === 'organizer'
          ? `${user.name} is now an organizer`
          : `${user.name} is now a participant` +
            (eventCount ? ` (their ${eventCount} event(s) stay, but they can no longer manage them)` : ''),
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, event_count: eventCount },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change role', error: error.message });
  }
};

module.exports = { listUsers, setUserRole };
