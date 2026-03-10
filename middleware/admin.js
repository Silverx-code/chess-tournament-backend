const { protect } = require('./auth');

const adminOnly = async (req, res, next) => {
  // First run the normal JWT protect middleware
  protect(req, res, async () => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied — admins only.' });
    }
    next();
  });
};

module.exports = { adminOnly };
