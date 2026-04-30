const express = require('express');
const router  = express.Router();

console.log("USER ROUTES LOADED");

const User = require('../models/User');
const authController = require('../controllers/userController');
const { isAuthenticated, isGuest } = require('../middleware/authMiddleware');
const { signupRules, loginRules, handleValidation } = require('../middleware/validate');
const addressController = require('../controllers/addressController');
const passport = require('passport');


router.use((req, res, next) => {
  console.log("ROUTE HIT:", req.method, req.url);
  next();
});

// ── Signup ───────────────────────────────────────────────────
router.get('/signup', isGuest, authController.getSignup);

router.post('/signup',
  isGuest,
  signupRules,
  handleValidation('/signup'),
  authController.postSignup
);

// ── Login ────────────────────────────────────────────────────
router.get('/login', isGuest, authController.getLogin);

router.post('/login',
  isGuest,
  loginRules,
  handleValidation('/login'),
  authController.postLogin
);


// show email input page
// router.get('/login-otp', (req, res) => {
//   res.render('user/login-otp');
// });

// // send OTP
// router.post('/login-otp', authController.sendLoginOTP);

// // verify OTP
// router.post('/verify-otp', authController.verifyLoginOTP);

// const passport = require('passport');



// Show OTP page
router.get('/verify-otp', (req, res) => {
  res.render('verify-otp', {
    phone:  req.session.pendingPhone,
    email:  req.session.pendingEmail,
    userId: req.session.pendingUserId,
    timerSeconds: 45,
    error: req.flash('error'),
  });
});

// Verify OTP
router.post('/verify-otp', authController.verifyOtp);

// Resend OTP
router.post('/resend-otp', authController.resendOtp);





// start login
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// callback
router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/user/login' }),
  (req, res) => {
    req.session.user = req.user._id;
    res.redirect('/user/dashboard');
  }
);





// ── Logout ───────────────────────────────────────────────────
// router.post('/logout', isAuthenticated, authController.logout);
// routes/userRoutes.js (or adminRoutes.js)

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log('Logout error:', err);
      return res.redirect('/user/home'); // fallback
    }

    res.clearCookie('connect.sid'); // remove session cookie
    res.redirect('/user/login'); // redirect after logout
  });
});


// ── Dashboard ────────────────────────────────────────────────
router.get('/dashboard', isAuthenticated, authController.getDashboard);


// ── Profile ─────────────────────────────────────────────────
const Address = require('../models/address'); // add this at top

router.get('/profile', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.user);

  const defaultAddress = await Address.findOne({
    user: req.session.user,
    isDefault: true
  });

  res.render('user/profile', { user, defaultAddress });
});

// ── Profile Edit ─────────────────────────────────────────────
router.get('/profileEdit', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.user);
  res.render('user/profileEdit', { user });
});


router.post('/profile/update', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user;

    console.log("BODY:", req.body); // DEBUG

    const fullName = req.body.fullName;

    let firstName = "";
    let lastName = "";

    if (fullName) {
      const parts = fullName.split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }

    await User.findByIdAndUpdate(userId, {
      firstName,
      lastName,
      email: req.body.email,
      phone: req.body.phone,
      dob: req.body.dob,
      gender: req.body.gender,
      country: req.body.country
    });

    res.redirect('/user/profileEdit');

  } catch (err) {
    console.log("PROFILE UPDATE ERROR:", err);
    res.status(500).send(err.message);
  }
});



// ── ADDRESS ROUTES ───────────────────────────────────────────

// ✅ 1. ADD PAGE
router.get('/add-address', (req, res) => {
  res.render('user/addresses/add-address');
});

// ✅ 2. LIST PAGE
router.get('/addresses', addressController.getAddresses);

// ✅ 3. ADD ACTION
router.post('/add-address', addressController.addAddress);


router.get('/addresses/:id/edit', async (req, res) => {
  const address = await Address.findById(req.params.id);
  res.render('user/addresses/editaddress', { address });
});

router.post('/addresses/:id/update', async (req, res) => {
  await Address.findByIdAndUpdate(req.params.id, req.body);
  res.redirect('/user/addresses');
});

router.post('/addresses/:id/delete', addressController.deleteAddress);

router.post('/addresses/:id/default', addressController.setDefaultAddress);


// ── ROOT ROUTE (KEEP THIS LAST ALWAYS) ───────────────────────
router.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/user/dashboard');
  res.redirect('/user/signup');
});

module.exports = router;