const User = require('../models/User');

const checkUserBlocked = async (req, res, next) => {

  try {

    // ✅ Skip admin routes
    if (req.originalUrl.startsWith('/admin')) {
      return next();
    }

    // ✅ No user logged in
    if (!req.session.userId) {
      return next();
    }

    const user = await User.findById(req.session.userId);

    // ✅ User deleted
    if (!user) {

      return req.session.destroy(() => {

        res.clearCookie('connect.sid');

        return res.redirect('/login');
      });
    }

    // ✅ User blocked
    if (user.isBlocked) {

      return req.session.destroy(() => {

        res.clearCookie('connect.sid');

        return res.render('user/login', {
          error: "Your account has been blocked by admin"
        });
      });
    }

    next();

  } catch (err) {

    console.log(err);

    next();
  }
};

module.exports = checkUserBlocked;