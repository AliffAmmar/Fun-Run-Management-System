const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the login token and sets req.user = { userId, role, email }.
// The role is read from the database on every request (not trusted from the token), so when an
// admin promotes or demotes someone it takes effect immediately, without logging in again.
// A deleted account is rejected.
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const user = await User.findById(decoded.userId).select('role email').lean();
    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists' });
    }
    req.user = { ...decoded, role: user.role, email: user.email };
    return next();
  } catch (error) {
    return next(error);
  }
};

// Allows only the given roles, e.g. requireRole('admin') or requireRole('organizer', 'admin').
// Use after authMiddleware.
const requireRole = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) return next();
  return res.status(403).json({ message: `Access denied. ${roles.join(' or ')} only.` });
};

// For public routes that show more to a logged-in user (e.g. an organizer seeing their own draft).
// Sets req.user when a valid token is sent; otherwise continues anonymously (never rejects).
const optionalAuthMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('role email').lean();
      if (user) req.user = { ...decoded, role: user.role, email: user.email };
    } catch (error) {
      // invalid/expired token: treat as anonymous
    }
  }
  next();
};

// Note: the old `adminMiddleware` was removed. Despite its name it let organizers through too,
// and it is no longer used anywhere. Use requireRole('admin') for admin-only routes.
module.exports = { authMiddleware, requireRole, optionalAuthMiddleware };
