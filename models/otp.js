const mongoose = require('mongoose');
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },

  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariant",
    default: null
  },

  name: String,
  image: String,

  size: String,
  color: String,

  price: {
    type: Number,
    required: true
  },

  quantity: {
    type: Number,
    required: true
  },

  total: {
    type: Number,
    required: true
  }

}, { _id: false });

const addressSchema = new mongoose.Schema({
  fullName: String,
  phone: String,

  addressLine1: String,
  addressLine2: String,

  city: String,
  state: String,
  pincode: String
}, { _id: false });

const orderSchema = new mongoose.Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  orderId: {
    type: String,
    unique: true,
    required: true
  },

  items: [orderItemSchema],

  address: addressSchema,

  paymentMethod: {
    type: String,
    enum: ["cod"],
    default: "cod"
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending"
  },

  orderStatus: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "shipped",
      "outfordelivery",
      "delivered",
      "cancelled",
      "returned"
    ],
    default: "pending"
  },

  subtotal: {
    type: Number,
    default: 0
  },

  discount: {
    type: Number,
    default: 0
  },

  shipping: {
    type: Number,
    default: 0
  },

  tax: {
    type: Number,
    default: 0
  },

  total: {
    type: Number,
    required: true
  }

}, {
  timestamps: true
});


const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: Date
});


module.exports = mongoose.model("Order", orderSchema);