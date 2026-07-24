const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  color: String,
  size: String,
  sku: String,

  price: { type: Number, required: true },
  discountPrice: { type: Number },

  stockQuantity: { type: Number, default: 0 },

  images: [String],

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
});

module.exports = mongoose.model("ProductVariant", variantSchema);
