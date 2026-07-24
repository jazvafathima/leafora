const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    label: {
      type: String,
      required: true, // Home, Work, etc.
    },

    name: {
      type: String,
      required: true, // person's name
    },

    street: {
      type: String,
      required: true,
    },

    line2: {
      type: String,
    },

    city: {
      type: String,
      required: true,
    },

    state: {
      type: String,
      required: true,
    },

    zip: {
      type: String,
      required: true,
    },

    country: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    altPhone: {
      type: String,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.Address || mongoose.model("Address", addressSchema);
