
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) return next();
  req.flash('error', 'Please log in to access this page.');
  res.redirect('/login');
  console.log("Auth check:", req.session);
};

// ─── Redirect logged-in users away from auth pages ────────────────────────
const isGuest = (req, res, next) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  next();
};

// ─── Admin only ───────────────────────────────────────────────────────────
const isAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admins only.');
  res.redirect('/dashboard');
};

module.exports = { isAuthenticated, isGuest, isAdmin };