
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) return next();
  req.flash('error', 'Please log in to access this page.');
  res.redirect('/login');
  console.log("Auth check:", req.session);
};

// ─── Redirect logged-in users away from auth pages ────────────────────────
const isGuest = (req, res, next) => {
  if (req.session && req.session.user) return res.redirect('/user/dashboard');
  next();
};



module.exports = { isAuthenticated, isGuest };