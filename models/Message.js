const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chessID:  { type: String, required: true, trim: true },
  name:     { type: String, required: true, trim: true },
  content:  { type: String, required: true, trim: true, maxlength: 500 },
  channel:  {
    type: String,
    enum: ['general', 'announcements'],
    default: 'general',
  },
  isPinned: { type: Boolean, default: false },
  reactions: {
    '👍': { type: [String], default: [] }, // array of chessIDs who reacted
    '❤️': { type: [String], default: [] },
    '😂': { type: [String], default: [] },
    '😮': { type: [String], default: [] },
    '♟':  { type: [String], default: [] },
  },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
