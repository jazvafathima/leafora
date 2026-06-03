const User = require("../models/User");
const bcrypt = require("bcrypt");

const {
  generateOTP,
  sendOTP,
  createAndSendOTP
} = require("../utils/otp");


// ── SIGNUP ─────────────────────────────
exports.signupUser = async ({
  firstName,
  lastName,
  email,
  password
}) => {

  let errors = {};

  if (!firstName)
    errors.firstName = "First name is required";

  if (!email)
    errors.email = "Email is required";

  if (!password)
    errors.password = "Password is required";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {

    return {
      errors: {
        email: "This email is already registered"
      }
    };
  }

  const newUser = new User({
    firstName,
    lastName,
    email,
    password,
    isVerified: false
  });

  await newUser.save();

  await createAndSendOTP(newUser);

  return { user: newUser };
};


// ── LOGIN ─────────────────────────────
exports.loginUser = async ({
  email,
  password
}) => {

  let errors = {};

  if (!email)
    errors.email = "Email is required";

  if (!password)
    errors.password = "Password is required";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const user = await User.findOne({ email });

  if (!user) {
    return {
      error: "No account found with this email"
    };
  }

  if (user.isBlocked) {
    return {
      error: "Your account is blocked by admin"
    };
  }

  if (!user.password) {
    return {
      error: "Please login using Google"
    };
  }

  const isMatch = await bcrypt.compare(
    password,
    user.password
  );

  if (!isMatch) {
    return {
      error: "Incorrect password"
    };
  }

  if (!user.isVerified) {
    return {
      error: "Please verify your email first"
    };
  }

  return { user };
};


// ── RESEND OTP ─────────────────────────
exports.resendOtp = async (userId) => {

  if (!userId) {
    return { error: "Session expired" };
  }

  const user = await User.findById(userId);

  if (!user) {
    return { error: "User not found" };
  }

  await createAndSendOTP(user);

  return { success: true };
};


// ── GET VERIFY OTP ─────────────────────
exports.getVerifyOtp = async (userId) => {

  if (!userId) {
    return { redirect: true };
  }

  const user = await User.findById(userId);

  if (!user) {
    return { redirect: true };
  }

  return { user };
};


// ── VERIFY OTP ─────────────────────────
exports.verifyOtp = async ({
  userId,
  otp
}) => {

  const user = await User.findById(userId);

  if (!otp) {
    return {
      error: "Please enter OTP"
    };
  }

  if (!user) {
    return {
      error: "User not found"
    };
  }

  if (user.otpExpiry < Date.now()) {
    return {
      error: "OTP expired"
    };
  }

  if (user.otp !== otp) {
    return {
      error: "Incorrect OTP"
    };
  }

  return { user };
};


// ── COMPLETE EMAIL CHANGE ──────────────
exports.completeEmailChange = async ({
  user,
  tempEmail,
  tempData
}) => {

  await User.findByIdAndUpdate(user._id, {
    email: tempEmail,
    ...tempData
  });

  user.otp = null;
  user.otpExpiry = null;

  await user.save();
};


// ── COMPLETE SIGNUP ────────────────────
exports.completeSignupVerification =
async (user) => {

  user.isVerified = true;
  user.otp = null;
  user.otpExpiry = null;

  await user.save();
};


// ── FORGOT PASSWORD ────────────────────
exports.forgotPassword = async (email) => {

  const user = await User.findOne({ email });

  if (!user) {
    return {
      error: "User not found"
    };
  }

  const otp = generateOTP().toString();

  user.otp = otp;
  user.otpExpiry = Date.now() + 5 * 60 * 1000;

  await user.save();

  await sendOTP(email, otp);

  return { user };
};


// ── RESET PASSWORD ─────────────────────
exports.resetPassword = async ({
  userId,
  newPassword,
  confirmPassword
}) => {

  if (!newPassword || !confirmPassword) {
    return {
      error: "All fields are required"
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      error: "Passwords do not match"
    };
  }

  const user = await User.findById(userId);

  if (!user) {
    return {
      error: "User not found"
    };
  }

  user.password = newPassword;

  await user.save();

  return { success: true };
};


// ── UPDATE PASSWORD ────────────────────
exports.updatePassword = async ({
  userId,
  currentPassword,
  newPassword,
  confirmPassword
}) => {

  if (
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {

    return {
      error: "All fields are required"
    };
  }

  if (newPassword !== confirmPassword) {

    return {
      error: "New passwords do not match"
    };
  }

  if (currentPassword === newPassword) {

    return {
      error: "New password must be different"
    };
  }

  const user = await User.findById(userId);

  if (!user) {
    return { redirect: true };
  }

  if (!user.password) {

    return {
      error:
        "You signed up with Google. Set a password first."
    };
  }

  const isMatch = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isMatch) {

    return {
      error: "Current password is incorrect"
    };
  }

  user.password = newPassword;

  await user.save();

  return { success: true };
};


// ── UPDATE PROFILE ─────────────────────
exports.updateProfile = async ({
  userId,
  body,
  file
}) => {

const fullName = body.fullName || "";
const email = body.email || "";
const phone = body.phone || "";
const dob = body.dob || "";
const gender = body.gender || "";
const country = body.country || "";

  const user = await User.findById(userId);


  if (!user) {
    return { redirect: true };
  }

  const cleanName = fullName.trim();

  if (!cleanName) {

    return {
      user,
      errors: {
        fullName: "Name is required"
      }
    };
  }

  const nameRegex =
    /^[A-Za-z]+(\s[A-Za-z]+)*$/;

  if (!nameRegex.test(cleanName)) {

    return {
      user,
      errors: {
        fullName:
          "Enter a valid name (letters only)"
      }
    };
  }

  const parts = cleanName.split(" ");

  const firstName = parts[0];

  const lastName =
    parts.slice(1).join(" ");

  // EMAIL CHANGE FLOW

  if (email.trim() && email !== user.email) {

    const exists = await User.findOne({
      email,
      _id: { $ne: userId }
    });

    if (exists) {

      return {
        user,
        errors: {
          email: "Email already in use"
        }
      };
    }

    await createAndSendOTP(user, email);

    return {
      emailChange: true,
      user,
      newEmail: email,
      tempProfileData: {
        firstName,
        lastName,
        phone,
        dob,
        gender,
        country
      }
    };
  }

let avatar;

if (file) {
  avatar = "/uploads/profile/" + file.filename;
}

const updateData = {
  firstName,
  lastName,
  phone,
  dob,
  gender,
  country
};

if (avatar) {
  updateData.avatar = avatar;
}

await User.findByIdAndUpdate(userId, updateData);

  return { success: true };
};