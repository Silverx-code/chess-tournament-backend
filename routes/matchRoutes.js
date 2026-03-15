const express  = require('express');
const Match    = require('../models/Match');
const User     = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const MATCH_LIMIT = 20;
const POINTS = { rapid: 1, daily: 3 };

// Max screenshot size: 5MB in base64
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024 * 1.37; // ~6.85MB base64

// ── POST /api/match/register ──────────────────────────────────────────
router.post('/register', protect, async (req, res) => {
  try {
    const { opponentChessID, matchType, winner, screenshot, screenshotMimeType } = req.body;
    const currentUser = req.user;

    // Basic validation
    if (!opponentChessID || !matchType || !winner) {
      return res.status(400).json({ message: 'opponentChessID, matchType, and winner are required.' });
    }

    if (!screenshot) {
      return res.status(400).json({ message: 'A screenshot of the match result is required.' });
    }

    if (!['rapid', 'daily'].includes(matchType)) {
      return res.status(400).json({ message: 'matchType must be "rapid" or "daily".' });
    }

    // Check screenshot size
    if (screenshot.length > MAX_SCREENSHOT_SIZE) {
      return res.status(400).json({ message: 'Screenshot is too large. Maximum size is 5MB.' });
    }

    const opponentID = opponentChessID.trim();

    if (opponentID.toLowerCase() === currentUser.chessID.toLowerCase()) {
      return res.status(400).json({ message: "You can't register a match against yourself." });
    }

    // Determine winner and loser
    const winnerChessID = winner.trim();
    const loserChessID  = winnerChessID === currentUser.chessID ? opponentID : currentUser.chessID;

    // Check monthly limit
    if (currentUser.matchesPlayed >= MATCH_LIMIT) {
      return res.status(429).json({ message: 'Monthly match limit of 20 reached. Resets on the 1st.' });
    }

    const pointsAwarded = POINTS[matchType];

    // Save match with screenshot
    const match = await Match.create({
      winnerChessID,
      loserChessID,
      matchType,
      pointsAwarded,
      screenshot,
      screenshotMimeType: screenshotMimeType || 'image/png',
    });

    // Update winner stats
    await User.findOneAndUpdate(
      { chessID: winnerChessID },
      { $inc: { totalPoints: pointsAwarded, matchesPlayed: 1 } }
    );

    // Update loser matchesPlayed
    await User.findOneAndUpdate(
      { chessID: loserChessID },
      { $inc: { matchesPlayed: 1 } }
    );

    const updatedUser = await User.findById(currentUser._id);

    // Return match without screenshot data to keep response small
    const matchResponse = match.toObject();
    delete matchResponse.screenshot;

    res.status(201).json({
      message: 'Match registered successfully.',
      match: matchResponse,
      pointsAwarded,
      user: updatedUser,
    });
  } catch (err) {
    console.error('Register match error:', err);
    res.status(500).json({ message: 'Server error registering match.' });
  }
});

// ── GET /api/matches?chessID=X ────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { chessID } = req.query;

    if (!chessID) {
      return res.status(400).json({ message: 'chessID query param is required.' });
    }

    // Exclude screenshot from list responses (too heavy)
    const matches = await Match.find({
      $or: [
        { winnerChessID: chessID },
        { loserChessID:  chessID },
      ],
    })
    .select('-screenshot')
    .sort({ createdAt: -1 });

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
