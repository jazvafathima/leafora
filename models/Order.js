const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },

    name: String,
    image: String,

    size: String,
    color: String,

    price: Number, // Final price after offer

    originalPrice: Number, // Before offer

    discountAmount: Number,

    discountPercent: Number,

    offerName: String,

    offerType: String,

    quantity: Number,

    total: Number,
    quantity: Number,
    total: Number,

    itemStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "shipped",
        "outForDelivery",
        "delivered",
        "cancelRequested",
        "cancelled",
        "returnRequested",
        "returned",
      ],
      default: "pending",
    },

    // CANCEL
    cancelReason: {
      type: String,
      default: "",
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    // RETURN
    returnStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected", "returned"],
      default: "none",
    },

    returnReason: {
      type: String,
      default: "",
    },

    returnRequestedAt: {
      type: Date,
      default: null,
    },

    returnApprovedAt: {
      type: Date,
      default: null,
    },

    returnedAt: {
      type: Date,
      default: null,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },

    finalPrice: {
      type: Number,
      default: 0,
    },
  },
  { _id: true },
);

const addressSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderId: {
      type: String,
      required: true,
      unique: true,
    },

    items: [orderItemSchema],

    address: addressSchema,

    paymentMethod: {
      type: String,
      enum: ["cod", "wallet", "online"],
      default: "cod",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    orderStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "shipped",
        "outForDelivery",
        "delivered",
        "cancelled",
        "returnRequested",
        "returned",
      ],
      default: "pending",
    },

    subtotal: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      default: null,
    },

    shipping: {
      type: Number,
      default: 0,
    },

    tax: {
      type: Number,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
