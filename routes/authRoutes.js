const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── POST /api/signup ──────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, chessID, password } = req.body;

    if (!name || !chessID || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const exists = await User.findOne({ chessID: chessID.trim() });
    if (exists) {
      return res.status(409).json({ message: 'That Chess.com ID is already registered.' });
    }

    const user = await User.create({
      name:    name.trim(),
      chessID: chessID.trim(),
      password,
    });

    res.status(201).json({ message: 'Account created successfully.', user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup.' });
  }
});

// ── POST /api/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { chessID, password } = req.body;

    if (!chessID || !password) {
      return res.status(400).json({ message: 'Chess ID and password are required.' });
    }

    const user = await User.findOne({ chessID: chessID.trim() }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid Chess ID or password.' });
    }

    // Check if blocked
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been permanently blocked. Contact the admin.' });
    }

    // Check if suspended
    if (user.isSuspended && user.suspendedUntil && new Date() < new Date(user.suspendedUntil)) {
      const until = new Date(user.suspendedUntil).toLocaleDateString();
      return res.status(403).json({ message: `Your account is suspended until ${until}.` });
    }

    // Auto-lift expired suspension
    if (user.isSuspended && user.suspendedUntil && new Date() >= new Date(user.suspendedUntil)) {
      user.isSuspended = false;
      user.suspendedUntil = null;
      await user.save();
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Chess ID or password.' });
    }

    const token = signToken(user._id);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

module.exports = router;
