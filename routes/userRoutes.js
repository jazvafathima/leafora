const express = require("express");
const router = express.Router();


const upload = require("../middleware/profileMulters");

const User = require("../models/User");
const authController = require("../controllers/userController");
const { isAuthenticated, isGuest } = require("../middleware/authMiddleware");
const {
  signupRules,
  loginRules,
  handleValidation,
} = require("../middleware/validate");
const addressController = require("../controllers/addressController");
const passport = require("passport");
const productController = require("../controllers/productController");
const cartController = require("../controllers/cartController");
const wishlistController = require("../controllers/wishlistController");
const checkoutCtrl = require("../controllers/checkoutController");
const orderController = require("../controllers/orderController");
const walletController=require("../controllers/walletController");

const { generateOTP, sendOTP, createAndSendOTP } = require("../utils/otp");




router.use((req, res, next) => {
  console.log("ROUTE HIT:", req.method, req.url);
  next();
});

// ── Signup ───────────────────────────────────────────────────
router.get("/signup", isGuest, authController.getSignup);

router.post(
  "/signup",
  isGuest,
  signupRules,
  handleValidation("/signup"),
  authController.postSignup,
);

// ── Login ────────────────────────────────────────────────────
router.get("/login", isGuest, authController.getLogin);

router.post(
  "/login",
  isGuest,
  loginRules,
  handleValidation("/login"),
  authController.postLogin,
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

router.post("/verify-otp", authController.verifyOtp);

router.get("/verify-otp", authController.getVerifyOtp);

// Resend OTP
router.post("/resend-otp", authController.resendOtp);

// start login
router.get(
  "/user/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

// callback
router.get(
  "/user/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.userId = req.user._id;
    res.redirect("/dashboard");
  },
);

// Forgot password
router.get("/forgot-password", (req, res) => {
  res.render("user/forgot-password");
});

router.post("/forgot-password", authController.forgotPassword);

// Reset password
router.get("/reset-password", (req, res) => {
  res.render("user/reset-password");
});

router.post("/reset-password", authController.resetPassword);

// ── Logout ───────────────────────────────────────────────────
// router.post('/logout', isAuthenticated, authController.logout);
// routes/userRoutes.js (or adminRoutes.js)

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Logout error:", err);
      return res.redirect("/dashboard"); // fallback
    }

    res.clearCookie("connect.sid"); // remove session cookie
    res.redirect("/login"); // redirect after logout
  });
});

// ── Dashboard ────────────────────────────────────────────────
// router.get('/dashboard', isAuthenticated, authController.getDashboard);
router.get("/dashboard", authController.getDashboard);

// ── Profile ─────────────────────────────────────────────────
const Address = require("../models/address");
const Order = require("../models/Order");

router.get("/profile", isAuthenticated, authController.getProfile);

// ── Profile Edit ─────────────────────────────────────────────
router.get("/profileEdit", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    res.render("user/profileEdit", { user });
  } catch (err) {
    console.log("PROFILE EDIT ERROR:", err);
    res.redirect("/profile");
  }
});

router.post(
  "/profileEdit",
  upload.single("avatar"),
  authController.updateProfile,
);

router.get("/change-password", isAuthenticated, (req, res) => {
  const success = req.session.success;
  const error = req.session.error;

  req.session.success = null;
  req.session.error = null;

  res.render("user/change-password", { success, error });
});

router.post("/update-password", isAuthenticated, authController.updatePassword);

// ── ADDRESS ROUTES ───────────────────────────────────────────

// ✅ 1. ADD PAGE
router.get("/add-address", (req, res) => {
  res.render("user/addresses/add-address");
});

// ✅ 2. LIST PAGE
router.get("/addresses", addressController.getAddresses);

// ✅ 3. ADD ACTION
router.post("/add-address", addressController.getAddAddress);

router.get("/addresses/:id/edit", async (req, res) => {
  const address = await Address.findById(req.params.id);
  res.render("user/addresses/editaddress", { address });
});

router.post("/addresses/:id/update", async (req, res) => {
  await Address.findByIdAndUpdate(req.params.id, req.body);
  res.redirect("/addresses");
});

router.post("/addresses/:id/delete", addressController.deleteAddress);

router.post("/addresses/:id/default", addressController.setDefaultAddress);

router.get("/productlist", productController.getUserProducts);

router.get("/product/:id", productController.getProductDetail);

router.get("/cart", cartController.getCart);

router.post("/cart/add", cartController.addToCart);

router.post("/cart/update", cartController.updateCartItem);

router.post("/cart/remove", cartController.removeCartItem);

router.get('/cart/count', cartController.getCartCount);

router.post("/buy-now", cartController.buyNow);

router.get("/wishlist", wishlistController.getWishlist);


// Toggle (add/remove) from product detail heart button
router.post("/wishlist/toggle", wishlistController.toggleWishlist);


// Explicitly remove one item
router.post("/wishlist/remove", wishlistController.removeFromWishlist);

// "Order Now" button — add to cart + remove from wishlist
router.post("/wishlist/add-to-cart", wishlistController.addToCartFromWishlist);

// Count (for badge)
router.get("/wishlist/count", wishlistController.getWishlistCount);

// ----------------------checkout-------------------

router.get(
  "/checkout",
  cartController.validateCartForCheckout,
  checkoutCtrl.getCheckout,
);

// Place order
router.post("/checkout/place-order", checkoutCtrl.placeOrder);
router.get("/checkout/status", checkoutCtrl.checkCartStatus);

// Order success
router.get("/checkout/success/:orderId", checkoutCtrl.getOrderSuccess);

// Address routes
router.post("/checkout/add-address", checkoutCtrl.addAddress); // also at /user/addresses/a
//
router.post("/checkout/address/:addressId", checkoutCtrl.editAddress);

router.post('/checkout/apply-coupon', checkoutCtrl.applyCoupon);
router.post('/checkout/remove-coupon', checkoutCtrl.removeCoupon);
router.post(
  "/checkout/create-razorpay-order",
  checkoutCtrl.createRazorpayOrder
);

router.post(
  "/checkout/verify-razorpay",
  checkoutCtrl.verifyRazorpayPayment
);


// -------wallet-----------


router.get('/wallet', isAuthenticated, walletController.getWalletPage);
 
// Add funds (Razorpay)
router.post('/wallet/add-funds', isAuthenticated, walletController.createRazorpayOrder);
router.post('/wallet/verify-payment', isAuthenticated, walletController.verifyAddFundsPayment);

 



router.get("/orderhistory",orderController.getOrderHistory);

router.get("/orders/:id", orderController.getOrderDetail);

router.post("/orders/:id/cancel", orderController.cancelOrder);

router.post("/orders/:orderId/item/:itemId/cancel", orderController.cancelItem);

router.post("/orders/:id/return", orderController.returnOrder);

router.post('/orders/:id/review', orderController.submitReview);

router.get(
  '/orders/:id/invoice',
  orderController.downloadInvoice
);


router.post(
  "/orders/:orderId/item/:itemId/return",
  orderController.returnItem
);

router.get("/orders/:id/invoice", orderController.downloadInvoice);






// ── ROOT ROUTE (KEEP THIS LAST ALWAYS) ───────────────────────
router.get("/", (req, res) => {
  if (req.session && req.session.userId) return res.redirect("/dashboard");
  res.redirect("/dashboard");
});

module.exports = router;
