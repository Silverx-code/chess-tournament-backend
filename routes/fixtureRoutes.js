const express = require('express');
const Fixture = require('../models/Fixture');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

const router = express.Router();

// ── GET /api/fixtures — get all fixtures (auth users) ─────────────────
router.get('/', protect, async (req, res) => {
  try {
    const fixtures = await Fixture.find({}).sort({ scheduledDate: 1 });
    res.json(fixtures);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/fixtures/mine — get fixtures for logged-in user ──────────
router.get('/mine', protect, async (req, res) => {
  try {
    const chessID = req.user.chessID;
    const fixtures = await Fixture.find({
      $or: [{ player1ChessID: chessID }, { player2ChessID: chessID }],
    }).sort({ scheduledDate: 1 });
    res.json(fixtures);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/fixtures — admin creates a fixture ──────────────────────
router.post('/', adminOnly, async (req, res) => {
  try {
    const { player1ChessID, player2ChessID, scheduledDate, round, notes } = req.body;
    if (!player1ChessID || !player2ChessID || !scheduledDate) {
      return res.status(400).json({ message: 'player1ChessID, player2ChessID, and scheduledDate are required.' });
    }
    if (player1ChessID.trim().toLowerCase() === player2ChessID.trim().toLowerCase()) {
      return res.status(400).json({ message: 'A player cannot be scheduled against themselves.' });
    }
    const fixture = await Fixture.create({
      player1ChessID: player1ChessID.trim(),
      player2ChessID: player2ChessID.trim(),
      scheduledDate:  new Date(scheduledDate),
      round:          round || 1,
      notes:          notes || '',
    });
    res.status(201).json({ message: 'Fixture created.', fixture });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/fixtures/:id — admin deletes a fixture ────────────────
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await Fixture.findByIdAndDelete(req.params.id);
    res.json({ message: 'Fixture deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/fixtures/:id — admin updates a fixture ────────────────
router.patch('/:id', adminOnly, async (req, res) => {
  try {
    const fixture = await Fixture.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!fixture) return res.status(404).json({ message: 'Fixture not found.' });
    res.json({ message: 'Fixture updated.', fixture });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
