const { calculateProductPrice } = require("../utils/priceHelper");

async function calculateCheckout(cart, offers, sessionCoupon) {

  const cartItems = cart.items
    .filter(item => item.product)
    .map(item => {

      const product = item.product;
      const variant = item.variant;

      const price = calculateProductPrice(
        product,
        variant,
        offers
      );
     

      return {
        ...item,
        product,
        variant,

        ...price,

        total: price.offerPrice * item.quantity,
      };
    });

    console.log(cartItems);
    cartItems.forEach(item => {
  console.log({
    originalPrice: item.originalPrice,
    offerPrice: item.offerPrice,
    quantity: item.quantity,
    total: item.total,
  });
});

  const orderSubtotal = cartItems.reduce(
    (sum, item) =>
      sum + item.originalPrice * item.quantity,
    0
  );

  const orderOfferDiscount = cartItems.reduce(
    (sum, item) =>
      sum +
      (item.originalPrice - item.offerPrice) *
        item.quantity,
    0
  );

  const orderCouponDiscount = sessionCoupon
    ? Number(sessionCoupon.discountAmount || 0)
    : 0;

  const amountAfterOffer =
    orderSubtotal - orderOfferDiscount;

  const orderShipping =
    amountAfterOffer > 0 && amountAfterOffer < 499
      ? 49
      : 0;

  const finalTotal = Math.max(
    amountAfterOffer -
      orderCouponDiscount +
      orderShipping,
    0
  );

  return {
    cartItems,
    orderSubtotal,
    orderOfferDiscount,
    orderCouponDiscount,
    orderShipping,
    finalTotal,
  };
}

module.exports = calculateCheckout;