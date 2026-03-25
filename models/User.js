const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  chessID:  { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, minlength: 6 },

  // ── League stats ───────────────────────────────────────────────────
  totalPoints:   { type: Number, default: 0 },
  wins:          { type: Number, default: 0 },
  draws:         { type: Number, default: 0 },
  losses:        { type: Number, default: 0 },
  matchesPlayed: { type: Number, default: 0 },
  month: {
    type: String,
    default: () => new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
  },

  // ── Admin / moderation ─────────────────────────────────────────────
  isAdmin:        { type: Boolean, default: false },
  isSuspended:    { type: Boolean, default: false },
  suspendedUntil: { type: Date,    default: null },
  isBlocked:      { type: Boolean, default: false },

  // ── Password reset ─────────────────────────────────────────────────
  resetPasswordToken:   { type: String,  default: undefined },
  resetPasswordExpires: { type: Number,  default: undefined },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
