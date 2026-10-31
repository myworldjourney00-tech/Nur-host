const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const { apiLimiter, authLimiter } = require('./middleware/security');

const authRoutes = require('./routes/authRoutes');
const websiteRoutes = require('./routes/websiteRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();

// কোর মিডলওয়্যার
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// স্ট্যাটিক ফ্রন্টএন্ড অ্যাসেটস
app.use(express.static(path.join(__dirname, '../public')));

// পাবলিক হোস্ট রুট (সরাসরি ইউজার ওয়েবসাইট ওপেন করার জন্য)
app.use('/u', publicRoutes);

// এপিআই রাউটস
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/websites', apiLimiter, websiteRoutes);

// হেলথ চেক রুট (Render-এর জন্য)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// কোনো অসংজ্ঞায়িত রুট আসলে হোমপেজে রিডাইরেক্ট
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// সার্ভার স্টার্ট
app.listen(config.PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Nur Host সার্ভার সফলভাবে চালু হয়েছে!`);
  console.log(`📡 পোর্ট: ${config.PORT}`);
  console.log(`🌐 মোড: ${config.NODE_ENV}`);
  console.log(`=========================================`);
});
