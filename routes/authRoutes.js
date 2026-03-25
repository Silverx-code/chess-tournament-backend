const express   = require('express');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const nodemailer = require('nodemailer');
const User      = require('../models/User');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── Gmail transporter ─────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not your real password)
  },
});

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
    const user = await User.create({ name: name.trim(), chessID: chessID.trim(), password });
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
    if (!user) return res.status(401).json({ message: 'Invalid Chess ID or password.' });

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been permanently blocked. Contact the admin.' });
    }
    if (user.isSuspended && user.suspendedUntil && new Date() < new Date(user.suspendedUntil)) {
      const until = new Date(user.suspendedUntil).toLocaleDateString();
      return res.status(403).json({ message: `Your account is suspended until ${until}.` });
    }
    if (user.isSuspended && user.suspendedUntil && new Date() >= new Date(user.suspendedUntil)) {
      user.isSuspended = false;
      user.suspendedUntil = null;
      await user.save();
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid Chess ID or password.' });

    const token = signToken(user._id);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ── POST /api/forgot-password ─────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { chessID, email } = req.body;
    if (!chessID || !email) {
      return res.status(400).json({ message: 'Chess ID and email are required.' });
    }

    const user = await User.findOne({ chessID: chessID.trim() });
    if (!user) {
      // Don't reveal if user exists — always return success message
      return res.json({ message: 'If that Chess ID is registered, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken   = crypto.randomBytes(32).toString('hex');
    const hashedToken  = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt    = Date.now() + 60 * 60 * 1000; // 1 hour

    user.resetPasswordToken   = hashedToken;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    // Build reset URL
    const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // Send email
    await transporter.sendMail({
      from:    `"ChessArena" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: '♟ ChessArena — Password Reset Request',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; background: #111811; color: #f0f4f0; padding: 32px; border-radius: 8px; border: 1px solid #2E7D32;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">♟</span>
            <h1 style="font-size: 24px; margin: 8px 0; color: #76ff03;">ChessArena</h1>
          </div>
          <p style="margin-bottom: 16px;">Hi <strong>${user.chessID}</strong>,</p>
          <p style="margin-bottom: 24px; color: #9eb09e;">You requested a password reset. Click the button below to set a new password. This link expires in <strong style="color: #f0f4f0;">1 hour</strong>.</p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetURL}" style="display: inline-block; background: #2E7D32; color: #fff; padding: 14px 32px; border-radius: 4px; text-decoration: none; font-weight: 600; letter-spacing: 0.05em;">
              ♟ Reset My Password
            </a>
          </div>
          <p style="font-size: 12px; color: #9eb09e; text-align: center;">If you didn't request this, ignore this email — your password won't change.</p>
          <hr style="border: none; border-top: 1px solid #2E7D32; margin: 24px 0;" />
          <p style="font-size: 11px; color: #9eb09e; text-align: center;">ChessArena · Monthly Chess Tournament</p>
        </div>
      `,
    });

    res.json({ message: 'If that Chess ID is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to send reset email. Try again later.' });
  }
});

// ── POST /api/reset-password/:token ──────────────────────────────────
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Hash the token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
    }

    // Set new password and clear reset fields
    user.password             = password;
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error resetting password.' });
  }
});

module.exports = router;
