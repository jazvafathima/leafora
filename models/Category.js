const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },

    image: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

categorySchema.pre("save", function () {
  if (this.name) {
    this.name = this.name.toLowerCase();
  }
});

categorySchema.index({ name: 1 }, { unique: true });

categorySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Category", categorySchema);
