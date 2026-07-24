exports.getBestOffer = (product, variant, offers = []) => {
  const now = new Date();

  const activeOffers = offers.filter(
    (offer) =>
      offer.isActive &&
      !offer.isDeleted &&
      new Date(offer.startDate) <= now &&
      new Date(offer.endDate) >= now,
  );

  const categoryId = product.category?._id || product.category;

  const productOffer = activeOffers.find(
    (offer) =>
      offer.type === "product" &&
      offer.target.toString() === product._id.toString(),
  );

  const categoryOffer = activeOffers.find(
    (offer) =>
      offer.type === "category" &&
      offer.target.toString() === categoryId?.toString(),
  );

  const basePrice =
    variant?.discountPrice || variant?.price || product.price || 0;

  let bestOffer = null;
  let bestDiscount = 0;

  [productOffer, categoryOffer].filter(Boolean).forEach((offer) => {
    let discountAmount = 0;

    if (offer.discountType === "percent") {
      discountAmount = (basePrice * offer.discountValue) / 100;

      if (offer.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, offer.maxDiscountAmount);
      }
    } else {
      discountAmount = offer.discountValue;
    }

    if (discountAmount > bestDiscount) {
      bestDiscount = discountAmount;
      bestOffer = offer;
    }
  });

  return {
    originalPrice: basePrice,

    discountAmount: bestDiscount,

    discountedPrice: Math.max(0, basePrice - bestDiscount),

    discountPercent:
      basePrice > 0 ? Math.round((bestDiscount / basePrice) * 100) : 0,

    offerName: bestOffer?.name || "",

    offerType: bestOffer?.type || "",

    hasOffer: !!bestOffer,
  };
};
