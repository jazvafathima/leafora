const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductVariant",
          default: null,
        },

        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema);
