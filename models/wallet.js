const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true,
  },

  amount: {
    type: Number,
    required: true,
    min: 0,
  },

  reason: {
    type: String,
    required: true,
  },

  transactionId: {
    type: String,
    required: true,
    unique: true,
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    transactions: [transactionSchema],
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
