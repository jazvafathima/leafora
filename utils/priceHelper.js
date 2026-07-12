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

  const applicableOffers = offers.filter(
    offer =>
      (offer.type === "product" &&
        offer.target.toString() === product._id.toString()) ||

      (offer.type === "category" &&
        offer.target.toString() === product.category.toString())
  );



 

  for (const offer of applicableOffers) {
  let discountedPrice = originalPrice;

    if (offer.discountType === "percent") {

        let discount =
            originalPrice * (offer.discountValue / 100);

        if (
            offer.maxDiscountAmount &&
            discount > offer.maxDiscountAmount
        ) {
            discount = offer.maxDiscountAmount;
        }

        discountedPrice = originalPrice - discount;

    } else if (offer.discountType === "flat") {

        discountedPrice =
            originalPrice - offer.discountValue;
    }

    discountedPrice = Math.max(
        0,
        Math.round(discountedPrice)
    );

    if (discountedPrice < bestPrice) {

        bestPrice = discountedPrice;

        bestDiscount =
            originalPrice - discountedPrice;
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