const express = require('express');
const router  = express.Router();

const User = require('../models/User');
const authController = require('../controllers/userController');
const { isAuthenticated, isGuest } = require('../middleware/authMiddleware');
const { signupRules, loginRules, handleValidation } = require('../middleware/validate')
const addressController = require('../controllers/addressController');



// ── Redirect root ─────────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.redirect('/signup');
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

// ── Logout ───────────────────────────────────────────────────
router.post('/logout', isAuthenticated, authController.logout);

// ── Dashboard ────────────────────────────────────────────────
router.get('/dashboard', isAuthenticated, authController.getDashboard);


// profile--------------------------

router.get('/profile', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.user);
  res.render('user/profile', { user });
});

// profileEdit-------------------------
router.get('/profileEdit', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.user);
  res.render('user/profileEdit', { user });
});
// ── ADDRESS ROUTES ─────────────────────────────────

router.get('/addresses', addressController.getAddresses);

router.post('/addresses/add', addressController.addAddress);

router.get('/addresses/:id/edit', addressController.getEditAddress);

router.post('/addresses/:id/edit', addressController.editAddress);

router.post('/addresses/:id/delete', addressController.deleteAddress);

router.post('/addresses/:id/default', addressController.setDefaultAddress);

module.exports = router;