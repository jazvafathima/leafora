const nodemailer = require("nodemailer");

// 🔢 Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 📧 Send OTP email
const sendOTP = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
  });
};

// 🔥 NEW: COMMON FUNCTION (THIS IS THE MAIN PART)
const createAndSendOTP = async (user, newEmail = null) => {
  const otp = generateOTP().toString();

  user.otp = otp;
  user.otpExpiry = Date.now() + 5 * 60 * 1000;

  await user.save();

  const emailToSend = newEmail || user.email;

  console.log("OTP SENDING TO:", emailToSend);

  await sendOTP(emailToSend, otp);
};

module.exports = { generateOTP, sendOTP, createAndSendOTP };
