const User = require('../models/User');
const bcrypt = require('bcrypt');
const { generateOTP, sendOTP } = require('../utils/otp');
// ── GET SIGNUP ─────────────────────────────
exports.getSignup = (req, res) => {
    res.render('user/signup');
};

// ── POST SIGNUP ────────────────────────────
exports.postSignup = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send("User already exists");
    }

    const otp = generateOTP();

    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      otp,
      otpExpiry: Date.now() + 60 * 1000, // 1 min
      isVerified: false
    });

    await newUser.save();

    // send OTP
    await sendOTP(email, otp);

    // ✅ store TEMP user (not logged in yet)
    req.session.tempUser = newUser._id;

    // ✅ redirect to OTP page
    res.redirect('/user/verify-otp');

  } catch (err) {
    console.log(err);
    res.send("Signup error");
  }
};




exports.getSignup = (req, res) => {
    const errors = req.flash('errors');
    const formData = req.flash('formData');

    res.render('user/signup', {
        errors: errors.length ? JSON.parse(errors[0]) : {},
        formData: formData.length ? JSON.parse(formData[0]) : {}
    });
};

// ── GET LOGIN ─────────────────────────────
exports.getLogin = (req, res) => {
    res.render('user/login');
};

// ── POST LOGIN ────────────────────────────
exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    // ❌ user not found
    if (!user) {
      return res.send("User not found");
    }

    // 🚫 ADD THIS HERE (before password check)
    if (user.isBlocked) {
      return res.send("Your account is blocked by admin");
    }

    // 🔑 compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.send("Invalid password");
    }

    // ✅ session
    req.session.user = user._id;

    // ❗ FIX THIS (you left it empty)
    res.redirect('/user/home');

  } catch (err) {
    console.log(err);
    res.send("Login error");
  }
};

// STEP 1: Send OTP
exports.resendOtp= async (req, res) => {
  const { email } = req.body;

  let user = await User.findOne({ email });

  // Optional: auto-create user if not exists
  if (!user) {
    user = new User({ email });
  }

  const otp = generateOTP();

  user.otp = otp;
  user.otpExpiry = Date.now() + 5 * 60 * 1000;

  await user.save();

  await sendOTP(email, otp);

  res.render('user/verify-otp', { email }); // go to OTP page
};


// STEP 2: Verify OTP
exports.verifyOtp = async (req, res) => {
  const { otp } = req.body;

  const user = await User.findById(req.session.tempUser);

  if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
    return res.send("Invalid or expired OTP");
  }

  // ✅ verify user
  user.isVerified = true;
  user.otp = null;
  user.otpExpiry = null;

  await user.save();

  // ✅ NOW login
  req.session.user = user._id;

  res.redirect('/user/dashboard');
};





// ── LOGOUT ────────────────────────────────
exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};

// ── DASHBOARD ─────────────────────────────
exports.getDashboard = (req, res) => {
    res.render('user/home');
};
module.exports = exports;


