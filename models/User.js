const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50,
      required: function () {
        return !this.googleId; // required only if NOT Google user
      },
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      required: function () {
        return !this.googleId;
      },
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    referralRewardGiven: {
      type: Boolean,
      default: false,
    },
    // // ── For future SSO (next steps) ─────────────────────────────────────
    googleId: { type: String, default: null },
    facebookId: { type: String, default: null },

    // ── For future forgot-password (next steps) ─────────────────────────
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },

  { timestamps: true },
);

// ─── Hash password before saving ─────────────────────────────────────────
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(12);

  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Instance method: compare password ───────────────────────────────────
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Virtual: full name ───────────────────────────────────────────────────
UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// module.exports = mongoose.model('User', UserSchema);
module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
