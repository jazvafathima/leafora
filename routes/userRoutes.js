const express = require('express');
const router  = express.Router();

console.log("USER ROUTES LOADED");
const upload=require('../middleware/profileMulters');

const User = require('../models/User');
const authController = require('../controllers/userController');
const { isAuthenticated, isGuest } = require('../middleware/authMiddleware');
const { signupRules, loginRules, handleValidation } = require('../middleware/validate');
const addressController = require('../controllers/addressController');
const passport = require('passport');
const productController = require('../controllers/productController');
const cartController = require("../controllers/cartController");
const wishlistController=require("../controllers/wishlistController")


const { generateOTP, sendOTP, createAndSendOTP } = require('../utils/otp');


console.log("authController:", authController);



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
// router.get('/verify-otp', async (req, res) => {

//   try {

//     const user = await User.findById(req.session.tempUser);

//     if (!user) {
//       return res.redirect('/signup');
//     }

router.post('/verify-otp', authController.verifyOtp);

router.get('/verify-otp', authController.getVerifyOtp);


// Resend OTP
router.post('/resend-otp', authController.resendOtp);

// start login
router.get('/user/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// callback
router.get('/user/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    req.session.userId = req.user._id;
    res.redirect('/dashboard');
  }
);


// Forgot password
router.get('/forgot-password', (req, res) => {
  res.render('user/forgot-password');
});

router.post('/forgot-password', authController.forgotPassword);



// Reset password
router.get('/reset-password', (req, res) => {
  res.render('user/reset-password');
});

router.post('/reset-password', authController.resetPassword);


// ── Logout ───────────────────────────────────────────────────
// router.post('/logout', isAuthenticated, authController.logout);
// routes/userRoutes.js (or adminRoutes.js)

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log('Logout error:', err);
      return res.redirect('/dashboard'); // fallback
    }

    res.clearCookie('connect.sid'); // remove session cookie
    res.redirect('/login'); // redirect after logout
  });
});


// ── Dashboard ────────────────────────────────────────────────
// router.get('/dashboard', isAuthenticated, authController.getDashboard);
router.get('/dashboard', isAuthenticated, authController.getDashboard);


// ── Profile ─────────────────────────────────────────────────
const Address = require('../models/address'); // add this at top

router.get('/profile', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.userId);

  const defaultAddress = await Address.findOne({
    user: req.session.userId,
    isDefault: true
  });

  res.render('user/profile', { user, defaultAddress });
});

// ── Profile Edit ─────────────────────────────────────────────
router.get('/profileEdit', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    res.render('user/profileEdit', { user });


  } catch (err) {
    console.log("PROFILE EDIT ERROR:", err);
    res.redirect('/profile');
  }
});

router.post(
  "/profileEdit",
  upload.single("avatar"),
  authController.updateProfile
);



  

router.get('/change-password', isAuthenticated, (req, res) => {
  const success = req.session.success;
  const error = req.session.error;

  req.session.success = null;
  req.session.error = null;

  res.render('user/change-password', { success, error });
});


router.post('/update-password', isAuthenticated, authController.updatePassword);



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
  res.redirect('/addresses');
});

router.post('/addresses/:id/delete', addressController.deleteAddress);

router.post('/addresses/:id/default', addressController.setDefaultAddress);





router.get('/productlist', productController.getUserProducts);


router.get("/product/:id", productController.getProductDetail);






router.get("/cart", cartController.getCart);

router.post("/cart/add", cartController.addToCart);

router.post("/cart/update",cartController.updateCartItem);

router.post("/cart/remove",  cartController.removeCartItem);




router.get('/wishlist',     wishlistController.getWishlist);

// Toggle (add/remove) from product detail heart button
router.post('/wishlist/toggle',       wishlistController.toggleWishlist);

// Explicitly remove one item
router.post('/wishlist/remove',       wishlistController.removeFromWishlist);

// "Order Now" button — add to cart + remove from wishlist
router.post('/wishlist/add-to-cart',  wishlistController.addToCartFromWishlist);

// Count (for badge)
router.get('/wishlist/count',         wishlistController.getWishlistCount);






// ── ROOT ROUTE (KEEP THIS LAST ALWAYS) ───────────────────────
router.get('/', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.redirect('/signup');
});

module.exports = router;