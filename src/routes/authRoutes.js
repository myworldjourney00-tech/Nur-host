const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const storage = require('../services/githubStorage');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

// সাইন-আপ
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, error: 'সবগুলো ফিল্ড পূরণ করা আবশ্যক।' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'পাসওয়ার্ড দুটি মেলেনি।' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userIndex = await storage.getIndex('users_index');

    if (userIndex[cleanEmail]) {
      return res.status(400).json({ success: false, error: 'এই ইমেইল দিয়ে ইতোমধ্যে অ্যাকাউন্ট তৈরি করা হয়েছে।' });
    }

    const userId = 'usr_' + crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    const userData = {
      id: userId,
      fullName: fullName.trim(),
      email: cleanEmail,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    // গিটহাবে ইউজার ডাটা সংরক্ষণ
    await storage.saveFile(`users/${userId}.json`, JSON.stringify(userData, null, 2), `Create user ${cleanEmail}`);
    
    // ইমেইল ইনডেক্স আপডেট
    userIndex[cleanEmail] = userId;
    await storage.saveIndex('users_index', userIndex);

    // টোকেন ও কুকি প্রদান
    const token = jwt.sign(
      { id: userData.id, email: userData.email, fullName: userData.fullName },
      config.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.cookie('nur_session', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      message: 'রেজিস্ট্রেশন সফল হয়েছে!',
      user: { id: userData.id, fullName: userData.fullName, email: userData.email }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ success: false, error: 'সার্ভারে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।' });
  }
});

// লগইন
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'ইমেইল ও পাসওয়ার্ড প্রদান করুন।' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userIndex = await storage.getIndex('users_index');
    const userId = userIndex[cleanEmail];

    if (!userId) {
      return res.status(401).json({ success: false, error: 'ভুল ইমেইল বা পাসওয়ার্ড।' });
    }

    const userFile = await storage.getFile(`users/${userId}.json`);
    if (!userFile) {
      return res.status(401).json({ success: false, error: 'ইউজার তথ্য খুঁজে পাওয়া যায়নি।' });
    }

    const userData = JSON.parse(userFile.content);
    const isMatch = await bcrypt.compare(password, userData.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'ভুল ইমেইল বা পাসওয়ার্ড।' });
    }

    const token = jwt.sign(
      { id: userData.id, email: userData.email, fullName: userData.fullName },
      config.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.cookie('nur_session', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'লগইন সফল হয়েছে!',
      user: { id: userData.id, fullName: userData.fullName, email: userData.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'লগইন প্রক্রিয়া ব্যাহত হয়েছে।' });
  }
});

// লগআউট
router.post('/logout', (req, res) => {
  res.clearCookie('nur_session', { path: '/api' });
  return res.json({ success: true, message: 'লগআউট সফল হয়েছে।' });
});

// কারেন্ট ইউজার স্টেট
router.get('/me', authMiddleware, (req, res) => {
  return res.json({ success: true, user: req.user });
});

module.exports = router;
