const express  = require('express');
const Match    = require('../models/Match');
const User     = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const MATCH_LIMIT = 20;
const POINTS = { rapid: 1, daily: 3 };

// ── POST /api/match/register ──────────────────────────────────────────
router.post('/register', protect, async (req, res) => {
  try {
    const { opponentChessID, matchType, winner } = req.body;
    const currentUser = req.user;

    // Basic validation
    if (!opponentChessID || !matchType || !winner) {
      return res.status(400).json({ message: 'opponentChessID, matchType, and winner are required.' });
    }

    if (!['rapid', 'daily'].includes(matchType)) {
      return res.status(400).json({ message: 'matchType must be "rapid" or "daily".' });
    }

    const opponentID = opponentChessID.trim();

    if (opponentID.toLowerCase() === currentUser.chessID.toLowerCase()) {
      return res.status(400).json({ message: "You can't register a match against yourself." });
    }

    // Determine winner and loser chessIDs
    const winnerChessID = winner.trim();
    const loserChessID  = winnerChessID === currentUser.chessID ? opponentID : currentUser.chessID;

    // Check monthly limit for the submitting user
    if (currentUser.matchesPlayed >= MATCH_LIMIT) {
      return res.status(429).json({ message: 'Monthly match limit of 20 reached. Resets on the 1st.' });
    }

    const pointsAwarded = POINTS[matchType];

    // Save match
    const match = await Match.create({
      winnerChessID,
      loserChessID,
      matchType,
      pointsAwarded,
    });

    // Update winner stats
    await User.findOneAndUpdate(
      { chessID: winnerChessID },
      { $inc: { totalPoints: pointsAwarded, matchesPlayed: 1 } }
    );

    // Update loser stats (matchesPlayed only, no points)
    await User.findOneAndUpdate(
      { chessID: loserChessID },
      { $inc: { matchesPlayed: 1 } }
    );

    // Refresh current user for response
    const updatedUser = await User.findById(currentUser._id);

    res.status(201).json({
      message: 'Match registered successfully.',
      match,
      pointsAwarded,
      user: updatedUser,
    });
  } catch (err) {
    console.error('Register match error:', err);
    res.status(500).json({ message: 'Server error registering match.' });
  }
});

// ── GET /api/matches?chessID=X ────────────────────────────────────────
// Returns all matches involving a given chessID, newest first
router.get('/', protect, async (req, res) => {
  try {
    const { chessID } = req.query;

    if (!chessID) {
      return res.status(400).json({ message: 'chessID query param is required.' });
    }

    const matches = await Match.find({
      $or: [
        { winnerChessID: chessID },
        { loserChessID:  chessID },
      ],
    }).sort({ createdAt: -1 });

    res.json(matches);
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ message: 'Server error fetching matches.' });
  }
});

// ── GET /api/leaderboard ──────────────────────────────────────────────
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const players = await User.find({}).sort({ totalPoints: -1, matchesPlayed: 1 });
    res.json(players);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Server error fetching leaderboard.' });
  }
});

module.exports = router;
