const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'অতিরিক্ত অনুরোধ করা হয়েছে। ১৫ মিনিট পর চেষ্টা করুন।' }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'রিকুয়েস্ট লিমিট অতিক্রম করেছে।' }
});

module.exports = { authLimiter, apiLimiter };
