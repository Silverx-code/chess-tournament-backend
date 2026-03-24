const express  = require('express');
const Match    = require('../models/Match');
const User     = require('../models/User');
const Fixture  = require('../models/Fixture');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/match/register ──────────────────────────────────────────
router.post('/register', protect, async (req, res) => {
  try {
    const {
      opponentChessID, matchType, winner, result,
      screenshot, screenshotMimeType, fixtureId,
    } = req.body;

    const currentUser = req.user;

    if (!opponentChessID || !matchType || !result) {
      return res.status(400).json({ message: 'opponentChessID, matchType, and result are required.' });
    }
    if (!screenshot) {
      return res.status(400).json({ message: 'A screenshot of the match result is required.' });
    }
    if (!['rapid', 'daily'].includes(matchType)) {
      return res.status(400).json({ message: 'matchType must be "rapid" or "daily".' });
    }
    if (!['win', 'draw'].includes(result)) {
      return res.status(400).json({ message: 'result must be "win" or "draw".' });
    }

    const opponentID = opponentChessID.trim();
    if (opponentID.toLowerCase() === currentUser.chessID.toLowerCase()) {
      return res.status(400).json({ message: "You can't register a match against yourself." });
    }

    // Points logic: win = 3pts to winner, draw = 1pt to each player
    let winnerChessID = null;
    let loserChessID  = null;
    let pointsAwarded = 0;

    if (result === 'win') {
      winnerChessID = (winner || currentUser.chessID).trim();
      loserChessID  = winnerChessID === currentUser.chessID ? opponentID : currentUser.chessID;
      pointsAwarded = 3;

      // Update winner
      await User.findOneAndUpdate(
        { chessID: winnerChessID },
        { $inc: { totalPoints: 3, matchesPlayed: 1, wins: 1 } }
      );
      // Update loser
      await User.findOneAndUpdate(
        { chessID: loserChessID },
        { $inc: { matchesPlayed: 1, losses: 1 } }
      );
    } else {
      // Draw — both players get 1 point
      pointsAwarded = 1;
      await User.findOneAndUpdate(
        { chessID: currentUser.chessID },
        { $inc: { totalPoints: 1, matchesPlayed: 1, draws: 1 } }
      );
      await User.findOneAndUpdate(
        { chessID: opponentID },
        { $inc: { totalPoints: 1, matchesPlayed: 1, draws: 1 } }
      );
    }

    const match = await Match.create({
      player1ChessID: currentUser.chessID,
      player2ChessID: opponentID,
      winnerChessID,
      loserChessID,
      result,
      matchType,
      pointsAwarded,
      screenshot,
      screenshotMimeType: screenshotMimeType || 'image/png',
      fixtureId: fixtureId || null,
    });

    // Mark fixture as completed if linked
    if (fixtureId) {
      await Fixture.findByIdAndUpdate(fixtureId, {
        $set: { status: 'completed', matchId: match._id },
      });
    }

    const updatedUser = await User.findById(currentUser._id);

    const matchResponse = match.toObject();
    delete matchResponse.screenshot;

    res.status(201).json({
      message: result === 'win'
        ? `Match registered! ${winnerChessID} wins +3 points.`
        : `Draw registered! Both players get +1 point.`,
      match: matchResponse,
      pointsAwarded,
      result,
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
    if (!chessID) return res.status(400).json({ message: 'chessID query param is required.' });

    const matches = await Match.find({
      $or: [
        { player1ChessID: chessID },
        { player2ChessID: chessID },
        { winnerChessID:  chessID },
        { loserChessID:   chessID },
      ],
    }).select('-screenshot').sort({ createdAt: -1 });

    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching matches.' });
  }
});

// ── GET /api/leaderboard ──────────────────────────────────────────────
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const players = await User.find({}).sort({ totalPoints: -1, wins: -1, matchesPlayed: 1 });
    res.json(players);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching leaderboard.' });
  }
});

module.exports = router;
