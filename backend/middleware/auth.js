const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'organizer')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin or organizer only.' });
  }
};

// For public routes that show more to a logged-in user (e.g. an organizer seeing their own draft).
// Sets req.user when a valid token is sent; otherwise continues anonymously (never rejects).
const optionalAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // invalid/expired token: treat as anonymous
    }
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, optionalAuthMiddleware };
