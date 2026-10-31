const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function authMiddleware(req, res, next) {
  const token = req.cookies.nur_session;

  if (!token) {
    return res.status(401).json({ success: false, error: 'অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded; // { id, email, fullName }
    next();
  } catch (err) {
    res.clearCookie('nur_session', { path: '/api' });
    return res.status(401).json({ success: false, error: 'সেশনের মেয়াদ শেষ হয়েছে। আবার লগইন করুন।' });
  }
};
