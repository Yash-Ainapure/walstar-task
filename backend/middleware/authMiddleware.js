const jwt = require('jsonwebtoken');
const User = require('../models/User');

const jwtSecret = process.env.JWT_SECRET;

// Middleware to protect routes and attach user info to req.user
const protect = async (req, res, next) => {
  try {
    let token = null;
    // Accept token in x-auth-token or Authorization: Bearer <token>
    if (req.headers['x-auth-token']) token = req.headers['x-auth-token'];
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    // expected payload: { userId, role, iat, exp }
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) return res.status(401).json({ msg: 'User not found' });

    req.user = { id: user._id.toString(), username: user.username, role: user.role };
    next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Helper to restrict to superadmin
const requireSuperadmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ msg: 'Not authenticated' });
  if (req.user.role !== 'superadmin') return res.status(403).json({ msg: 'Requires superadmin' });
  next();
};

module.exports = { protect, requireSuperadmin };
