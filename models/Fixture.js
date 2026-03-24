const mongoose = require('mongoose');

const fixtureSchema = new mongoose.Schema({
  player1ChessID: { type: String, required: true, trim: true },
  player2ChessID: { type: String, required: true, trim: true },
  scheduledDate:  { type: Date, required: true },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'postponed'],
    default: 'scheduled',
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    default: null,
  },
  round: { type: Number, default: 1 },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Fixture', fixtureSchema);
