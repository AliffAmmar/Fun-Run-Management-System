const jwt = require('jsonwebtoken');

const generateToken = (userId, role, email) => {
  return jwt.sign(
    { userId, role, email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = { generateToken, verifyToken };
