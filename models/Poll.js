const mongoose = require('mongoose');

// One poll document per month
const pollSchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
    unique: true,
  },
  options: [
    {
      option: { type: String, required: true },  // chessID
      votes:  { type: Number, default: 0 },
    }
  ],
  // Track who voted to prevent double-voting
  voters: [
    {
      type: String,  // chessID of voter
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model('Poll', pollSchema);
