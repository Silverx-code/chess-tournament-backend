const express = require('express');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

const router = express.Router();

const EMOJIS = ['👍', '❤️', '😂', '😮', '♟'];

// ── GET /api/chat/:channel ────────────────────────────────────────────
// Fetch messages for a channel (general or announcements)
router.get('/:channel', protect, async (req, res) => {
  try {
    const { channel } = req.params;
    if (!['general', 'announcements'].includes(channel)) {
      return res.status(400).json({ message: 'Invalid channel.' });
    }

    // Pinned messages first, then newest last (chat order)
    const messages = await Message.find({ channel })
      .sort({ isPinned: -1, createdAt: 1 })
      .limit(100);

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/chat/:channel ───────────────────────────────────────────
// Send a message — announcements channel is admin only
router.post('/:channel', protect, async (req, res) => {
  try {
    const { channel } = req.params;
    const { content }  = req.body;

    if (!['general', 'announcements'].includes(channel)) {
      return res.status(400).json({ message: 'Invalid channel.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required.' });
    }
    if (content.trim().length > 500) {
      return res.status(400).json({ message: 'Message too long — max 500 characters.' });
    }

    // Only admins can post in announcements
    if (channel === 'announcements' && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Only admins can post announcements.' });
    }

    const message = await Message.create({
      chessID: req.user.chessID,
      name:    req.user.name,
      content: content.trim(),
      channel,
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/chat/:id ──────────────────────────────────────────────
// Admin can delete any message
router.delete('/:id', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found.' });

    // Only admin or message owner can delete
    if (!req.user.isAdmin && message.chessID !== req.user.chessID) {
      return res.status(403).json({ message: 'Not authorised to delete this message.' });
    }

    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: 'Message deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/chat/:id/pin ───────────────────────────────────────────
// Admin pins/unpins a message
router.patch('/:id/pin', adminOnly, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found.' });

    message.isPinned = !message.isPinned;
    await message.save();

    res.json({ message: message.isPinned ? 'Message pinned.' : 'Message unpinned.', isPinned: message.isPinned });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PATCH /api/chat/:id/react ─────────────────────────────────────────
// Toggle an emoji reaction
router.patch('/:id/react', protect, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!EMOJIS.includes(emoji)) {
      return res.status(400).json({ message: 'Invalid emoji.' });
    }

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found.' });

    const chessID   = req.user.chessID;
    const reactors  = message.reactions[emoji] || [];
    const alreadyReacted = reactors.includes(chessID);

    if (alreadyReacted) {
      // Remove reaction
      message.reactions[emoji] = reactors.filter(id => id !== chessID);
    } else {
      // Add reaction
      message.reactions[emoji] = [...reactors, chessID];
    }

    message.markModified('reactions');
    await message.save();

    res.json({ reactions: message.reactions });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
