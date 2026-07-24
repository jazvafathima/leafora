const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductVariant",
        },
        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
