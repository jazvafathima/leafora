const isAdminLoggedIn = (req, res, next) => {
  if (!req.session.adminId) {
    return res.redirect("/admin/login");
  }

  next();
};

const checkAuth = (req, res, next) => {
  if (req.session.adminId) {
    return res.redirect("/admin/dashboard");
  }
  next();
};

module.exports = { isAdminLoggedIn, checkAuth };
