require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const cron     = require('node-cron');

const authRoutes  = require('./routes/authRoutes');
const matchRoutes = require('./routes/matchRoutes');
const pollRoutes  = require('./routes/pollRoutes');
const adminRoutes = require('./routes/adminRoutes');
const User        = require('./models/User');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api', authRoutes);                    // POST /api/signup, /api/login
app.use('/api/match', matchRoutes);             // POST /api/match/register, GET /api/match
app.use('/api/leaderboard', (req, res, next) => {
  req.url = '/leaderboard';
  matchRoutes(req, res, next);
});
app.use('/api/matches', (req, res, next) => {
  req.url = '/';
  matchRoutes(req, res, next);
});
app.use('/api/poll', pollRoutes);               // GET /api/poll
app.use('/api/vote', pollRoutes);               // POST /api/vote
app.use('/api/admin', adminRoutes);             // All admin routes

// ── Health check ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ChessArena API is running ♟', time: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
});

// ── Monthly reset cron job ────────────────────────────────────────────
cron.schedule('0 0 1 * *', async () => {
  try {
    const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    await User.updateMany({}, {
      $set: { totalPoints: 0, matchesPlayed: 0, month },
    });
    console.log(`✅ Monthly reset complete for ${month}`);
  } catch (err) {
    console.error('Monthly reset failed:', err);
  }
});

// ── Connect to MongoDB then start server ──────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
