const userService = require("../services/userService");
const Product = require("../models/Product");
const ProductVariant = require("../models/productvariant");
const User = require("../models/User");
const Order = require("../models/Order");
const Address = require("../models/Address");
const Wallet = require("../models/wallet");
const Wishlist = require("../models/wishlist");
const {
  getActiveOffers,
  calculateProductPrice,
} = require("../utils/priceHelper");
const nodemailer = require("nodemailer");

// ── GET SIGNUP ─────────────────────────────

exports.getSignup = (req, res) => {
  res.render("user/signup", {
    formData: {},
    errors: {},
  });
};

// ── POST SIGNUP ────────────────────────────
exports.postSignup = async (req, res) => {
  try {
    const result = await userService.signupUser(req.body);

    if (result.errors) {
      return res.render("user/signup", {
        errors: result.errors,
        formData: req.body,
      });
    }

    req.session.tempUser = result.user._id;

    res.redirect("/verify-otp");
  } catch (err) {
    console.log(err);

    res.render("user/signup", {
      error: "Something went wrong",
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
      password: req.body.password?.trim(),
    });

    if (result.errors) {
      return res.render("user/login", {
        errors: result.errors,
        formData: { email: req.body.email },
      });
    }

    if (result.error) {
      return res.render("user/login", {
        error: result.error,
        formData: { email: req.body.email },
      });
    }

    req.session.userId = result.user._id;

    res.redirect("/");
  } catch (err) {
    console.log(err);

    res.render("user/login", {
      error: "Something went wrong",
    });
  }
};

// ── RESEND OTP ────────────────────────────
exports.resendOtp = async (req, res) => {
  try {
    const result = await userService.resendOtp(req.session.tempUser);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    return res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── GET VERIFY OTP ─────────────────────────
exports.getVerifyOtp = async (req, res) => {
  try {
    const result = await userService.getVerifyOtp(req.session.tempUser);
    // Initialize resend timer only once
    if (!req.session.resendAvailableAt) {
      req.session.resendAvailableAt = Date.now() + 45 * 1000;
    }

    if (result.redirect) {
      return res.redirect("/signup");
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil((req.session.resendAvailableAt - Date.now()) / 1000),
    );

    return res.render("user/verify-otp", {
      email: req.session.tempEmail || result.user.email,
      timerSeconds: remainingSeconds,
      error: null,
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
      otp: req.body.otp,
    });

    if (result.error) {
      const user = await User.findById(req.session.tempUser);

      const remainingSeconds = Math.max(
        0,
        Math.ceil((req.session.resendAvailableAt - Date.now()) / 1000),
      );

      return res.render("user/verify-otp", {
        email: req.session.tempEmail || user.email,
        error: result.error,
        timerSeconds: remainingSeconds,
      });
    }

    const user = result.user;

    // EMAIL CHANGE FLOW
    if (req.session.otpPurpose === "email-change") {
      await userService.completeEmailChange({
        user,
        tempEmail: req.session.tempEmail,
        tempData: req.session.tempProfileData,
      });

      req.session.tempEmail = null;
      req.session.tempProfileData = null;
      req.session.otpPurpose = null;

      return res.redirect("/profile");
    }

    // NORMAL SIGNUP FLOW
    await userService.completeSignupVerification(user);

    req.session.userId = user._id;

    return res.redirect("/");
  } catch (err) {
    console.log(err);

    return res.render("user/verify-otp", {
      error: "Something went wrong",
    });
  }
};

// ── FORGOT PASSWORD ───────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const result = await userService.forgotPassword(req.body.email);

    if (result.error) {
      return res.render("user/forgot-password", {
        error: result.error,
      });
    }

    req.session.tempUser = result.user._id;

    res.redirect("/verify-otp");
  } catch (err) {
    console.log(err);

    res.render("user/forgot-password", {
      error: "Something went wrong",
    });
  }
};

// ── VERIFY RESET OTP ──────────────────────
exports.verifyResetOtp = async (req, res) => {
  try {
    const result = await userService.resendOtp(req.session.tempUser);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// ── RESET PASSWORD ────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const result = await userService.resetPassword({
      userId: req.session.resetUserId,
      newPassword: req.body.newPassword?.trim(),
      confirmPassword: req.body.confirmPassword?.trim(),
    });

    if (result.error) {
      return res.render("user/reset-password", {
        error: result.error,
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
      confirmPassword: req.body.confirmPassword?.trim(),
    });

    if (result.redirect) {
      return res.redirect("/login");
    }

    if (result.error) {
      return res.render("user/change-password", {
        error: result.error,
      });
    }

    req.session.success = "Password updated successfully";

    res.redirect("/change-password");
  } catch (err) {
    console.log(err);

    res.render("user/change-password", {
      error: "Something went wrong",
    });
  }
};

// ── UPDATE PROFILE ────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const result = await userService.updateProfile({
      userId: req.session.userId,
      body: req.body,
      file: req.file,
    });

    if (result.redirect) {
      return res.redirect("/login");
    }

    if (result.errors) {
      return res.render("user/profileEdit", {
        user: result.user,
        errors: result.errors,
      });
    }

    if (result.emailChange) {
      req.session.tempUser = result.user._id;
      req.session.otpPurpose = "email-change";
      req.session.tempEmail = result.newEmail;

      req.session.tempProfileData = result.tempProfileData;

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
      const wishlist = await Wishlist.findOne({ user: userId }).lean();

      wishlistIds = wishlist
        ? wishlist.items.map((item) => item.product.toString())
        : [];
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

    for (const p of allProducts
      .filter((p) => p.variants?.length > 0)
      .slice(0, 5)) {
      const variant = p.variants[0];

      const price = calculateProductPrice(p, variant, offers);

      products.push({
        ...p,
        ...price,
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
      referredBy: userId,
    })
      .select("firstName lastName email createdAt")
      .lean();

    // Referral statistics
    const referralStats = {
      total: referrals.length,
      successful: referrals.length,
      rewards: referrals.length * 100,
    };

    // Prepare referral history for EJS
    const referralHistory = referrals.map((ref) => ({
      friendName: `${ref.firstName} ${ref.lastName || ""}`.trim(),
      friendEmail: ref.email,
      joinedAt: ref.createdAt,
      status: "successful",
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
      siteUrl: process.env.SITE_URL,
    });
  } catch (err) {
    console.error("Profile Error:", err);
    res.redirect("/");
  }
};

exports.profileEdit = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    res.render("user/profileEdit", { user });
  } catch (err) {
    console.log("PROFILE EDIT ERROR:", err);
    res.redirect("/profile");
  }
};

exports.getUserProducts = async (req, res) => {
  const products = await Product.find({
    isDeleted: false,
  }).populate("category");
  let wishlistIds = [];

  if (req.session.userId) {
    const wishlist = await Wishlist.findOne({
      userId: req.session.userId,
    });

    if (wishlist) {
      wishlistIds = wishlist.products.map((id) => id.toString());
    }
  }

  res.render("user/productlist", {
    products: [],
    wishlistIds: [],
  });
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});
exports.getconctact = async (req, res) => {
  try {
    res.render("user/contact", {
      formAction: "/contact/submit",
      infoCards: [
        {
          icon: "fa-location-dot",
          title: "Address",
          lines: ["123 Commerce Street", "New York, NY 10001", "United States"],
        },
        {
          icon: "fa-envelope",
          title: "Support Email",
          lines: ["support@leaforamail.com"],
        },
        {
          icon: "fa-phone",
          title: "Phone Number",
          lines: ["+1 (555) 123-4567", "Toll-free 1-800-445BLE"],
        },
        {
          icon: "fa-clock",
          title: "Support Hours",
          lines: [
            "Monday - Friday: 8am - 8pm EST",
            "Saturday: 9am - 6pm EST",
            "Sunday: Closed",
          ],
        },
      ],
      mapImageUrl: null,
      storeAddress: "123 Commerce Street, New York, NY 10001",
      qrCodeUrl: null,
      phone: "+91 9090000000",
      email: "support@leafora.com",
      year: new Date().getFullYear(),
    });
  } catch (err) {
    console.error(err);
  }
};

exports.postContact = async (req, res) => {
  try {
    const { fullName, email, phone, subject, message } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).render("user/contact", {
        // ✅ updated
        error: "Please fill in your name, email, and message.",
        formAction: "/contact/submit",
      });
    }

    if (message.trim().length < 10) {
      return res.status(400).render("user/contact", {
        // ✅ updated
        error: "Your message must be at least 10 characters long.",
        formAction: "/contact/submit",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).render("user/contact", {
        // ✅ updated
        error: "Please enter a valid email address.",
        formAction: "/contact/submit",
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;

    await transporter.sendMail({
      from: `"Leafora Contact Form" <${process.env.EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      replyTo: email,
      subject: `New Contact Message: ${subject || "General Inquiry"}`,
      html: `
    <h2>New Contact Form Submission</h2>

    <p><strong>Name:</strong> ${fullName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone || "N/A"}</p>
    <p><strong>Subject:</strong> ${subject || "N/A"}</p>

    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, "<br>")}</p>
  `,
    });

    req.flash("success", "Your message has been sent successfully!");
    res.redirect("/contact");
  } catch (err) {
    req.flash("error", "Could not send your message. Please try again later.");
    res.redirect("/contact");
  }
};

exports.getAbout = async (req, res) => {
  try {
    res.render("user/about", {
      founded: 2019,
      storyImageUrl: null,
      values: [
        {
          icon: "fa-seedling",
          title: "Sustainably Grown",
          text: "Every plant is sourced from growers who share our commitment to the environment.",
        },
        {
          icon: "fa-truck-fast",
          title: "Reliable Delivery",
          text: "Carefully packaged and shipped so your plants arrive healthy, every time.",
        },
        {
          icon: "fa-hand-holding-heart",
          title: "Real Plant Care",
          text: "Our team offers genuine advice to help your plants — and your space — flourish.",
        },
        {
          icon: "fa-users",
          title: "Community First",
          text: "We support local growers, small makers, and green initiatives in every city we serve.",
        },
      ],
      aboutStats: [
        { value: "50K+", label: "Happy Customers" },
        { value: "1,200+", label: "Plant Varieties" },
        { value: "35+", label: "Cities Served" },
        { value: "6", label: "Years of Growth" },
      ],
      team: [
        { name: "Ava Thompson", role: "Founder & CEO", image: null },
        { name: "Noah Bennett", role: "Head of Sourcing", image: null },
        { name: "Maya Patel", role: "Plant Care Lead", image: null },
        { name: "Liam Carter", role: "Operations Manager", image: null },
      ],
      qrCodeUrl: null,
      phone: "+91 9090000000",
      email: "support@leafora.com",
      year: new Date().getFullYear(),
    });
  } catch (err) {
    console.error("Error loading about page:", err);
    res
      .status(500)
      .render("error", {
        message: "Something went wrong. Please try again later.",
      });
  }
};

exports.getNotFound = async (req, res) => {
  res.status(404).render("user/404", {
    searchAction: "/shop",
    quickLinks: [
      { label: "Track Order", href: "/orders/track" },
      { label: "Contact Us", href: "/contact" },
    ],
    qrCodeUrl: null,
    phone: "+91 9090000000",
    email: "support@leafora.com",
    year: new Date().getFullYear(),
  });
};

exports.getServerError = (err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(err.status || 500).render("user/500", {
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong on our end. Please try again shortly."
        : err.message, // show real error in dev, generic message in prod
    year: new Date().getFullYear(),
  });
};

// Optional: 403 — forbidden/unauthorized access (e.g. admin routes, blocked users)
exports.getForbidden = async (req, res) => {
  res.status(403).render("user/403", {
    year: new Date().getFullYear(),
  });
};
