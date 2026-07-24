const Offer = require("../models/Offer");

async function getActiveOffers() {
  const now = new Date();

  return await Offer.find({
    isActive: true,
    isDeleted: false,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).lean();
}

function calculateProductPrice(product, variant, offers) {
  const originalPrice = variant.price;

  let bestPrice = originalPrice;
  let bestDiscount = 0;

  const categoryId = product.category?._id || product.category;

  const applicableOffers = offers.filter((offer) => {
    if (offer.type === "product") {
      return offer.target.toString() === product._id.toString();
    }

    if (offer.type === "category") {
      return offer.target.toString() === categoryId.toString();
    }

    return false;
  });

  for (const offer of applicableOffers) {
    console.log({
      product: product.name,
      offer: offer.name,
      type: offer.type,
      discountType: offer.discountType,
      value: offer.discountValue,
    });

    let discountedPrice = originalPrice;

    if (offer.discountType === "percent") {
      let discount = originalPrice * (offer.discountValue / 100);

      if (offer.maxDiscountAmount && discount > offer.maxDiscountAmount) {
        discount = offer.maxDiscountAmount;
      }

      discountedPrice = originalPrice - discount;
    } else if (offer.discountType === "flat") {
      discountedPrice = originalPrice - offer.discountValue;
    }

    discountedPrice = Math.max(0, Math.round(discountedPrice));

    if (discountedPrice < bestPrice) {
      bestPrice = discountedPrice;

      bestDiscount = originalPrice - discountedPrice;
    }
  }

  return {
    originalPrice,
    offerPrice: bestPrice,
    offerDiscount: bestDiscount,
    hasOffer: bestPrice < originalPrice,
    savings: originalPrice - bestPrice,
  };
}

module.exports = {
  getActiveOffers,
  calculateProductPrice,
};
