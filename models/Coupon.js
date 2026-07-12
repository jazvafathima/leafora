const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  discountType: {
    type: String,
    enum: ['flat', 'percentage'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  minPurchase: {
    type: Number,
    default: 0,       // no minimum by default
    min: 0,
  },
  maxDiscount: {
    type: Number,
    default: null,    // cap for percentage coupons — null means no cap
  },
  usageLimit: {
    type: Number,
    required: true,
    min: 1,
  },
  perUserLimit: {
    type: Number,
    default: 1,       // once per user by default
    min: 1,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },

  // Track who used it and when — needed for perUserLimit validation
  usedBy: [{
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedAt: { type: Date, default: Date.now },
  }],

}, { timestamps: true });

// Always exclude soft-deleted coupons
couponSchema.pre(/^find/, function(next) {
  this.where({ isDeleted: false });
  
});

const Coupon =
  mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);

module.exports = Coupon;