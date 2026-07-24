const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  req.flash("error", "Please log in to access this page.");
  return res.redirect("/login");
  console.log("Auth check:", req.session);
};

// authMiddleware.jsexports.isAuthenticated = (req, res, next) => {
exports.isAuthenticated = (req, res, next) => {
  console.log("SESSION:", req.session); // ✅ ADD HERE

  if (!req.session.userId || req.session.adminId) {
    console.log("❌ NOT AUTHENTICATED");
    return res.redirect("/login");
  }

  console.log("✅ AUTHENTICATED");

  next();
};

// ─── Redirect logged-in users away from auth pages ────────────────────────
const isGuest = (req, res, next) => {
  if (req.session && req.session.userId) return res.redirect("/");
  next();
};

module.exports = { isAuthenticated, isGuest };
