const User = require('../models/User');
const bcrypt = require('bcrypt');
const { generateOTP, sendOTP, createAndSendOTP } = require('../utils/otp');



// ── GET SIGNUP ─────────────────────────────
exports.getSignup = (req, res) => {
  res.render('user/signup');
};


// ── POST SIGNUP ────────────────────────────
exports.postSignup = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    let errors = {};
    if (!firstName) errors.firstName = "First name is required";
    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      return res.render("user/signup", { errors, formData: req.body });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.render("user/signup", {
        errors: { email: "This email is already registered" },
        formData: req.body
      });
    }

    // ✅ NO manual hash (schema handles it)
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      isVerified: false
    });

    await newUser.save();

    // ✅ send OTP once
    await createAndSendOTP(newUser);

    req.session.tempUser = newUser._id;

    res.redirect('/verify-otp');

  } catch (err) {
    console.log(err);
    res.render("user/signup", { error: "Something went wrong" });
  }
};


// ── GET LOGIN ─────────────────────────────
exports.getLogin = (req, res) => {
  res.render('user/login');
};


// ── POST LOGIN ────────────────────────────
exports.postLogin = async (req, res) => {
  try {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();

    let errors = {};
    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      return res.render("user/login", {
        errors,
        formData: { email }
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/login", {
        error: "No account found with this email",
        formData: { email }
      });
    }

    if (user.isBlocked) {
      return res.render("user/login", {
        error: "Your account is blocked by admin"
      });
    }

    if (!user.password) {
      return res.render("user/login", {
        error: "Please login using Google"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("user/login", {
        error: "Incorrect password",
        formData: { email }
      });
    }

    if (!user.isVerified) {
      return res.render("user/login", {
        error: "Please verify your email first"
      });
    }

    req.session.userId = user._id;

    res.redirect('/dashboard');

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

    console.log("RESEND CLICKED");

    const userId = req.session.tempUser;

    console.log("SESSION USER:", userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Session expired"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await createAndSendOTP(user);
    

    console.log("NEW OTP SENT");

    return res.json({
      success: true,
    });

  } catch (err) {

    console.log("RESEND OTP ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
  


exports.getVerifyOtp = async (req, res) => {

  try {

    if (!req.session.tempUser) {
      return res.redirect('/signup');
    }

    const user = await User.findById(req.session.tempUser);

    if (!user) {
      return res.redirect('/signup');
    }

    return res.render('user/verify-otp', {
      email: req.session.tempEmail || user.email,
      timerSeconds: 45,
      error: null
    });

  } catch (err) {

    console.log("GET VERIFY OTP ERROR:", err);

    return res.redirect('/signup');
  }
};


// ── VERIFY OTP ────────────────────────────
exports.verifyOtp = async (req, res) => {

  try {

    const { otp } = req.body;

    const user = await User.findById(req.session.tempUser);

    if (!otp) {
      return res.render('user/verify-otp', {
        error: "Please enter OTP"
      });
    }

    if (!user) {
      return res.render('user/verify-otp', {
        error: "User not found"
      });
    }

    if (user.otpExpiry < Date.now()) {
      return res.render('user/verify-otp', {
        error: "OTP expired"
      });
    }

    if (user.otp !== otp) {
      return res.render('user/verify-otp', {
        error: "Incorrect OTP"
      });
    }

    // ✅ EMAIL CHANGE FLOW
    if (req.session.otpPurpose === "email-change") {

      const tempData = req.session.tempProfileData;

      await User.findByIdAndUpdate(user._id, {
        email: req.session.tempEmail,
        ...tempData
      });

      user.otp = null;
      user.otpExpiry = null;

      await user.save();

      console.log("EMAIL CHANGE FLOW RUNNING");
      console.log("NEW EMAIL:", req.session.tempEmail);

      req.session.tempEmail = null;
      req.session.tempProfileData = null;
      req.session.otpPurpose = null;

      return res.redirect('/profile');
    }

    // ✅ NORMAL SIGNUP FLOW
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    req.session.userId = user._id;

    return res.redirect('/dashboard');

  } catch (err) {

    console.log("VERIFY OTP ERROR:", err);

    return res.render('user/verify-otp', {
      error: "Something went wrong"
    });
  }
};

// ── FORGOT PASSWORD ───────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.render('user/forgot-password', {
        error: "User not found"
      });
    }

    const otp = generateOTP().toString();

    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000;

    await user.save();

    await sendOTP(email, otp);

    req.session.tempUser = user._id;

    res.redirect('/verify-otp');

  } catch (err) {
    console.log(err);
    res.render('user/forgot-password', {
      error: "Something went wrong"
    });
  }
};


// ── VERIFY RESET OTP ──────────────────────
exports.verifyResetOtp = async (req, res) => {

  try {

    const userId = req.session.tempUser;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Session expired"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await createAndSendOTP(user);

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully"
    });

  } catch (err) {

    console.log("RESEND OTP ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};
// ── RESET PASSWORD ────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const newPassword = req.body.newPassword?.trim();
    const confirmPassword = req.body.confirmPassword?.trim();

    if (!newPassword || !confirmPassword) {
      return res.render('user/reset-password', {
        error: "All fields are required"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render('user/reset-password', {
        error: "Passwords do not match"
      });
    }

    const user = await User.findById(req.session.resetUserId);

    if (!user) {
      return res.redirect('/forgot-password');
    }

    user.password = newPassword; // pre-save hook hashes

    await user.save();

    req.session.resetUserId = null;

    res.redirect('/login');

  } catch (err) {
    console.log(err);
    res.status(500).send("Error resetting password");
  }
};


// ── CHANGE PASSWORD ───────────────────────
exports.updatePassword = async (req, res) => {
  try {
    const userId = req.session.userId;

    const currentPassword = req.body.currentPassword?.trim();
    const newPassword = req.body.newPassword?.trim();
    const confirmPassword = req.body.confirmPassword?.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render('user/change-password', {
        error: "All fields are required"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render('user/change-password', {
        error: "New passwords do not match"
      });
    }

    if (currentPassword === newPassword) {
      return res.render('user/change-password', {
        error: "New password must be different"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/login');
    }

    if (!user.password) {
      return res.render('user/change-password', {
        error: "You signed up with Google. Set a password first."
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.render('user/change-password', {
        error: "Current password is incorrect"
      });
    }

    user.password = newPassword;

    await user.save();

    req.session.success = "Password updated successfully";

    res.redirect('/change-password');

  } catch (err) {
    console.log("CHANGE PASSWORD ERROR:", err);
    res.render('user/change-password', {
      error: "Something went wrong"
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {

    const userId = req.session.userId;

    const {
      fullName = "",
      email = "",
      phone = "",
      dob = "",
      gender = "",
      country = ""
    } = req.body || {};

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/login');
    }

    // ===============================
    // NAME VALIDATION
    // ===============================

    const cleanName = fullName.trim();

    if (!cleanName) {
      return res.render('user/profileEdit', {
        user,
        errors: { fullName: "Name is required" }
      });
    }

    const nameRegex = /^[A-Za-z]+(\s[A-Za-z]+)*$/;

    if (!nameRegex.test(cleanName)) {
      return res.render('user/profileEdit', {
        user,
        errors: { fullName: "Enter a valid name (letters only)" }
      });
    }

    const parts = cleanName.split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");

    // ===============================
    // EMAIL CHANGE FLOW
    // ===============================

    if (email.trim() && email !== user.email) {

      const exists = await User.findOne({
        email,
        _id: { $ne: userId }
      });

      if (exists) {
        return res.render('user/profileEdit', {
          user,
          errors: { email: "Email already in use" }
        });
      }

      await createAndSendOTP(user, email);

      req.session.tempUser = user._id;
      req.session.otpPurpose = "email-change";
      req.session.tempEmail = email;

      req.session.tempProfileData = {
        firstName,
        lastName,
        phone,
        dob,
        gender,
        country
      };

      return res.redirect('/verify-otp');
    }

    // ===============================
    // NORMAL UPDATE
    // ===============================

    await User.findByIdAndUpdate(userId, {
      firstName,
      lastName,
      phone,
      dob,
      gender,
      country
    });

    return res.redirect('/profile');

  } catch (err) {
    console.log("PROFILE UPDATE ERROR:", err);
    return res.status(500).send("Something went wrong");
  }
};

// ── LOGOUT ────────────────────────────────

  exports.logout = (req, res) => {

  req.session.destroy((err) => {

    if (err) {
      return res.redirect('/profile');
    }

    res.clearCookie('connect.sid');

    res.redirect('/login');
  });

};
    


// ── DASHBOARD ─────────────────────────────
exports.getDashboard = (req, res) => {
  res.render('user/home');
};

