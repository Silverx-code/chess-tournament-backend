const express = require('express');
const Poll    = require('../models/Poll');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const currentMonth = () =>
  new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

// ── GET /api/poll ─────────────────────────────────────────────────────
// Returns this month's poll, creating it from the top-4 leaderboard if needed
router.get('/', protect, async (req, res) => {
  try {
    const month = currentMonth();
    let poll = await Poll.findOne({ month });

    if (!poll) {
      // Build poll from top-4 players by points
      const topPlayers = await User.find({}).sort({ totalPoints: -1 }).limit(4);
      const options = topPlayers.map(p => ({ option: p.chessID, votes: 0 }));

      // Need at least 2 players to create a poll
      if (options.length < 2) {
        return res.json({ month, options: [], userVoted: false });
      }

      poll = await Poll.create({ month, options, voters: [] });
    }

    const userVoted = poll.voters.includes(req.user.chessID);

    res.json({
      month:     poll.month,
      options:   poll.options,
      userVoted,
    });
  } catch (err) {
    console.error('Get poll error:', err);
    res.status(500).json({ message: 'Server error fetching poll.' });
  }
});

// ── POST /api/vote ────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { option } = req.body;
    const voterID = req.user.chessID;
    const month   = currentMonth();

    if (!option) {
      return res.status(400).json({ message: 'option is required.' });
    }

    const poll = await Poll.findOne({ month });
    if (!poll) {
      return res.status(404).json({ message: 'No poll found for this month yet.' });
    }

    // Prevent double-voting
    if (poll.voters.includes(voterID)) {
      return res.status(409).json({ message: 'You have already voted this month.' });
    }

    // Find and increment the chosen option
    const opt = poll.options.find(o => o.option === option);
    if (!opt) {
      return res.status(400).json({ message: 'Invalid poll option.' });
    }

    opt.votes += 1;
    poll.voters.push(voterID);
    await poll.save();

    res.json({ message: 'Vote recorded.', poll });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ message: 'Server error recording vote.' });
  }
});

module.exports = router;
