const userService = require("../services/userService");
const Product = require("../models/Product");
const ProductVariant = require("../models/productvariant");
const User = require('../models/User');
const Order = require('../models/Order');
 const Address = require("../models/Address");
 const Wallet=require("../models/wallet");

 const {
    getActiveOffers,
    calculateProductPrice,
} = require("../utils/priceHelper");



// ── GET SIGNUP ─────────────────────────────

exports.getSignup = (req, res) => {
  res.render("user/signup", {
    formData: {},
    errors: {}
  });
};


// ── POST SIGNUP ────────────────────────────
exports.postSignup = async (req, res) => {

  try {

    const result = await userService.signupUser(req.body);

    if (result.errors) {
      return res.render("user/signup", {
        errors: result.errors,
        formData: req.body
      });
    }

    req.session.tempUser = result.user._id;

    res.redirect("/verify-otp");

  } catch (err) {

    console.log(err);

    res.render("user/signup", {
      error: "Something went wrong"
    });
  }
};


// ── GET LOGIN ─────────────────────────────
exports.getLogin = (req, res) => {
  res.render("user/login");
};


// ── POST LOGIN ────────────────────────────
exports.postLogin = async (req, res) => {

  try {

    const result = await userService.loginUser({
      email: req.body.email?.trim(),
      password: req.body.password?.trim()
    });

    if (result.errors) {

      return res.render("user/login", {
        errors: result.errors,
        formData: { email: req.body.email }
      });
    }

    if (result.error) {

      return res.render("user/login", {
        error: result.error,
        formData: { email: req.body.email }
      });
    }

    req.session.userId = result.user._id;

    res.redirect("/dashboard");

  } catch (err) {

    console.log(err);

    res.render("user/login", {
      error: "Something went wrong"
    });
  }
};


// ── RESEND OTP ────────────────────────────
exports.resendOtp = async (req, res) => {

  try {

    const result = await userService.resendOtp(
      req.session.tempUser
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    return res.json({
      success: true
    });

  } catch (err) {

    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


// ── GET VERIFY OTP ─────────────────────────
exports.getVerifyOtp = async (req, res) => {

  try {

    const result = await userService.getVerifyOtp(
      req.session.tempUser
    );

    if (result.redirect) {
      return res.redirect("/signup");
    }

    return res.render("user/verify-otp", {
      email: req.session.tempEmail || result.user.email,
      timerSeconds: 45,
      error: null
    });

  } catch (err) {

    console.log(err);

    return res.redirect("/signup");
  }
};


// ── VERIFY OTP ────────────────────────────
exports.verifyOtp = async (req, res) => {

  try {

    const result = await userService.verifyOtp({
      userId: req.session.tempUser,
      otp: req.body.otp
    });

    if (result.error) {

      return res.render("user/verify-otp", {
        error: result.error
      });
    }

    const user = result.user;

    // EMAIL CHANGE FLOW
    if (req.session.otpPurpose === "email-change") {

      await userService.completeEmailChange({
        user,
        tempEmail: req.session.tempEmail,
        tempData: req.session.tempProfileData
      });

      req.session.tempEmail = null;
      req.session.tempProfileData = null;
      req.session.otpPurpose = null;

      return res.redirect("/profile");
    }

    // NORMAL SIGNUP FLOW
    await userService.completeSignupVerification(user);

    req.session.userId = user._id;

    return res.redirect("/dashboard");

  } catch (err) {

    console.log(err);

    return res.render("user/verify-otp", {
      error: "Something went wrong"
    });
  }
};


// ── FORGOT PASSWORD ───────────────────────
exports.forgotPassword = async (req, res) => {

  try {

    const result = await userService.forgotPassword(
      req.body.email
    );

    if (result.error) {

      return res.render("user/forgot-password", {
        error: result.error
      });
    }

    req.session.tempUser = result.user._id;

    res.redirect("/verify-otp");

  } catch (err) {

    console.log(err);

    res.render("user/forgot-password", {
      error: "Something went wrong"
    });
  }
};


// ── VERIFY RESET OTP ──────────────────────
exports.verifyResetOtp = async (req, res) => {

  try {

    const result = await userService.resendOtp(
      req.session.tempUser
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully"
    });

  } catch (err) {

    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};


// ── RESET PASSWORD ────────────────────────
exports.resetPassword = async (req, res) => {

  try {

    const result = await userService.resetPassword({
      userId: req.session.resetUserId,
      newPassword: req.body.newPassword?.trim(),
      confirmPassword: req.body.confirmPassword?.trim()
    });

    if (result.error) {

      return res.render("user/reset-password", {
        error: result.error
      });
    }

    req.session.resetUserId = null;

    res.redirect("/login");

  } catch (err) {

    console.log(err);

    res.status(500).send("Error resetting password");
  }
};


// ── CHANGE PASSWORD ───────────────────────
exports.updatePassword = async (req, res) => {

  try {

    const result = await userService.updatePassword({
      userId: req.session.userId,
      currentPassword: req.body.currentPassword?.trim(),
      newPassword: req.body.newPassword?.trim(),
      confirmPassword: req.body.confirmPassword?.trim()
    });

    if (result.redirect) {
      return res.redirect("/login");
    }

    if (result.error) {

      return res.render("user/change-password", {
        error: result.error
      });
    }

    req.session.success =
      "Password updated successfully";

    res.redirect("/change-password");

  } catch (err) {

    console.log(err);

    res.render("user/change-password", {
      error: "Something went wrong"
    });
  }
};


// ── UPDATE PROFILE ────────────────────────
exports.updateProfile = async (req, res) => {

  try {

    const result = await userService.updateProfile({
      userId: req.session.userId,
      body: req.body,
      file: req.file
    });

    if (result.redirect) {
      return res.redirect("/login");
    }

    if (result.errors) {

      return res.render("user/profileEdit", {
        user: result.user,
        errors: result.errors
      });
    }

    if (result.emailChange) {

      req.session.tempUser = result.user._id;
      req.session.otpPurpose = "email-change";
      req.session.tempEmail = result.newEmail;

      req.session.tempProfileData =
        result.tempProfileData;

      return res.redirect("/verify-otp");
    }

    return res.redirect("/profile");

  } catch (err) {

    console.log(err);

    return res.status(500).send("Something went wrong");
  }

 

};

// ── LOGOUT ────────────────────────────────
exports.logout = (req, res) => {

  req.session.destroy((err) => {

    if (err) {
      return res.redirect("/profile");
    }

    res.clearCookie("connect.sid");

    res.redirect("/login");
  });
};


// ── DASHBOARD ─────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    let wishlistIds = [];

    const userId = req.session.userId || req.session.user?._id;

    if (userId) {
      const user = await User.findById(userId)
        .select("wishlist")
        .lean();

      wishlistIds = (user?.wishlist || []).map(id => id.toString());
    }

    const search = req.query.search || "";

    const query = {
      status: "active",
      isDeleted: false,
    };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const allProducts = await Product.find(query)
      .populate({
        path: "variants",
        model: "ProductVariant",
        match: { status: "active" },
      })
      .populate("category")
      .sort({ createdAt: -1 })
      .lean();

const offers = await getActiveOffers();

const products = [];

for (const p of allProducts.filter(p => p.variants?.length > 0).slice(0, 5)) {

    const variant = p.variants[0];

    const price = calculateProductPrice(
        p,
        variant,
        offers
    );

    products.push({
        ...p,
        ...price
    });
}

    return res.render("user/home", {
      products,
      wishlistIds,
      search,
    });

  } catch (err) {
    console.error("DASHBOARD ERROR:", err);

    return res.render("user/home", {
      products: [],
      wishlistIds: [],
      search: "",
    });
  }
};




exports.getProfile = async (req, res) => {
  try {
    const userId = req.session.userId;

    const [user, defaultAddress, orders, wallet] = await Promise.all([
      User.findById(userId).lean(),
      Address.findOne({ user: userId, isDefault: true }).lean(),
      Order.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      Wallet.findOne({ user: userId }).lean(),
    ]);

    const transactions = wallet?.transactions || [];

    const totalCredits = transactions
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = transactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);


     // Users referred by the current user
const referrals = await User.find({
  referredBy: userId
})
.select("firstName lastName email createdAt")
.lean();

// Referral statistics
const referralStats = {
  total: referrals.length,
  successful: referrals.length,
  rewards: referrals.length * 100
};

// Prepare referral history for EJS
const referralHistory = referrals.map(ref => ({
  friendName: `${ref.firstName} ${ref.lastName || ""}`.trim(),
  friendEmail: ref.email,
  joinedAt: ref.createdAt,
  status: "successful"
}));

    res.render("user/profile", {
      user,
      defaultAddress,
      orders,
      wallet,
      transactions,
      totalCredits,
      totalDebits,
      referralStats,
      referrals: referralHistory,
      siteUrl: process.env.SITE_URL
    });
  } catch (err) {
    console.error("Profile Error:", err);
    res.redirect("/dashboard");
  }
};


exports.getUserProducts = async (req, res) => {
  const products = await Product.find({
    isDeleted: false
  }).populate('category');
  let wishlistIds = [];

if (req.session.userId) {
  const wishlist = await Wishlist.findOne({
    userId: req.session.userId
  });

  if (wishlist) {
    wishlistIds = wishlist.products.map(id => id.toString());
  }
}


  res.render("user/productlist", {
      products: [],
      wishlistIds: []
  
});
};
