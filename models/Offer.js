const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['product', 'category'],
    required: true,
  },
  target: {
    // Stores either a Product _id or Category _id depending on `type`
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'type',     // dynamic ref: 'product' → Product, 'category' → Category
  },
  discountType: {
    type: String,
    enum: ['percent', 'flat'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  maxDiscountAmount: {
    type: Number,
    default: null
},
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
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
  
}, {
  timestamps: true,
});

// Always exclude soft-deleted offers from queries
offerSchema.pre(/^find/, function(next) {
  this.where({ isDeleted: false });
  
});




module.exports = mongoose.models.Offer || mongoose.model("Offer", offerSchema);