const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const Match   = require('../models/Match');
const { adminOnly } = require('../middleware/admin');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── POST /api/admin/login ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { chessID, password } = req.body;
    if (!chessID || !password) {
      return res.status(400).json({ message: 'Chess ID and password are required.' });
    }
    const user = await User.findOne({ chessID: chessID.trim() }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
    if (!user.isAdmin) return res.status(403).json({ message: 'This account does not have admin access.' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });
    const token = signToken(user._id);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────
router.get('/users', adminOnly, async (req, res) => {
  try {
    const users = await User.find({}).sort({ totalPoints: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/admin/users/:chessID/points ────────────────────────────
router.patch('/users/:chessID/points', adminOnly, async (req, res) => {
  try {
    const { points } = req.body;
    if (typeof points !== 'number') {
      return res.status(400).json({ message: 'points must be a number.' });
    }
    const user = await User.findOneAndUpdate(
      { chessID: req.params.chessID },
      { $set: { totalPoints: points } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `Points updated to ${points}.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/admin/users/:chessID/password ──────────────────────────
// Admin resets a user's password
router.patch('/users/:chessID/password', adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    const user = await User.findOne({ chessID: req.params.chessID });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Hash the new password and save
    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    res.json({ message: `Password for ${user.chessID} has been reset successfully.` });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/admin/users/:chessID/suspend ───────────────────────────
router.patch('/users/:chessID/suspend', adminOnly, async (req, res) => {
  try {
    const { days } = req.body;
    if (!days || days < 1) {
      return res.status(400).json({ message: 'days must be a positive number.' });
    }
    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + days);
    const user = await User.findOneAndUpdate(
      { chessID: req.params.chessID },
      { $set: { isSuspended: true, suspendedUntil } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.chessID} suspended for ${days} day(s).`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/admin/users/:chessID/unsuspend ─────────────────────────
router.patch('/users/:chessID/unsuspend', adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { chessID: req.params.chessID },
      { $set: { isSuspended: false, suspendedUntil: null } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.chessID} unsuspended.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/admin/users/:chessID/block ─────────────────────────────
router.patch('/users/:chessID/block', adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { chessID: req.params.chessID },
      { $set: { isBlocked: true, isSuspended: false, suspendedUntil: null } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.chessID} has been permanently blocked.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/admin/users/:chessID/unblock ───────────────────────────
router.patch('/users/:chessID/unblock', adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { chessID: req.params.chessID },
      { $set: { isBlocked: false } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.chessID} unblocked.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/admin/matches/:matchId ────────────────────────────────
router.delete('/matches/:matchId', adminOnly, async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Match not found.' });
    await User.findOneAndUpdate(
      { chessID: match.winnerChessID },
      { $inc: { totalPoints: -match.pointsAwarded, matchesPlayed: -1 } }
    );
    await User.findOneAndUpdate(
      { chessID: match.loserChessID },
      { $inc: { matchesPlayed: -1 } }
    );
    await Match.findByIdAndDelete(req.params.matchId);
    res.json({ message: 'Match deleted and points reversed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/admin/users/:chessID/reset ────────────────────────────
router.patch('/users/:chessID/reset', adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { chessID: req.params.chessID },
      { $set: { totalPoints: 0, matchesPlayed: 0 } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.chessID}'s stats have been reset.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/admin/users/:chessID/promote ───────────────────────────
router.patch('/users/:chessID/promote', adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { chessID: req.params.chessID },
      { $set: { isAdmin: true } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.chessID} is now an admin.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/admin/matches ────────────────────────────────────────────
router.get('/matches', adminOnly, async (req, res) => {
  try {
    const matches = await Match.find({}).sort({ createdAt: -1 }).limit(100).select('-screenshot');
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/admin/matches/:matchId/screenshot ────────────────────────
router.get('/matches/:matchId/screenshot', adminOnly, async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId).select('screenshot screenshotMimeType winnerChessID loserChessID');
    if (!match) return res.status(404).json({ message: 'Match not found.' });
    if (!match.screenshot) return res.status(404).json({ message: 'No screenshot for this match.' });
    res.json({
      screenshot: match.screenshot,
      screenshotMimeType: match.screenshotMimeType,
      winnerChessID: match.winnerChessID,
      loserChessID: match.loserChessID,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;