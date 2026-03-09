const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  winnerChessID: {
    type: String,
    required: true,
    trim: true,
  },
  loserChessID: {
    type: String,
    required: true,
    trim: true,
  },
  matchType: {
    type: String,
    enum: ['rapid', 'daily'],
    required: true,
  },
  pointsAwarded: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  month: {
    type: String,
    default: () => new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
  },
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
