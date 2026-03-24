const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  winnerChessID: {
    type: String,
    trim: true,
    default: null, // null for draws
  },
  loserChessID: {
    type: String,
    trim: true,
    default: null, // null for draws
  },
  player1ChessID: { type: String, required: true, trim: true },
  player2ChessID: { type: String, required: true, trim: true },
  result: {
    type: String,
    enum: ['win', 'draw'],
    required: true,
  },
  matchType: {
    type: String,
    enum: ['rapid', 'daily'],
    required: true,
  },
  pointsAwarded: { type: Number, required: true }, // points to winner (3) or each player (1)
  date:  { type: Date, default: Date.now },
  month: {
    type: String,
    default: () => new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
  },
  screenshot: { type: String, required: true },
  screenshotMimeType: { type: String, default: 'image/png' },
  fixtureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fixture',
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
