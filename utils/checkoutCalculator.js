const { calculateProductPrice } = require("../utils/priceHelper");

async function calculateCheckout(cart, offers, sessionCoupon) {
  // STEP 1: Build cart items
  const cartItems = cart.items
    .filter((item) => item.product)
    .map((item) => {
      const product = item.product;
      const variant = item.variant;

      const price = calculateProductPrice(product, variant, offers);

      return {
        ...item,
        product,
        variant,

        ...price,

        total: price.offerPrice * item.quantity,
      };
    });

  // STEP 2: Calculate totals
  const orderSubtotal = cartItems.reduce(
    (sum, item) => sum + item.originalPrice * item.quantity,
    0,
  );

  const orderOfferDiscount = cartItems.reduce(
    (sum, item) => sum + (item.originalPrice - item.offerPrice) * item.quantity,
    0,
  );

  const amountAfterOffer = cartItems.reduce((sum, item) => sum + item.total, 0);

  let orderCouponDiscount = sessionCoupon
    ? Number(sessionCoupon.discountAmount || 0)
    : 0;

  // STEP 3: Distribute coupon
  if (sessionCoupon && orderCouponDiscount > 0) {
    let distributed = 0;

    cartItems.forEach((item, index) => {
      let couponDiscount;

      if (index === cartItems.length - 1) {
        // Give remaining discount to last item
        couponDiscount = Number((orderCouponDiscount - distributed).toFixed(2));
      } else {
        couponDiscount = Number(
          ((item.total / amountAfterOffer) * orderCouponDiscount).toFixed(2),
        );

        distributed += couponDiscount;
      }

      item.couponDiscount = couponDiscount;
      item.finalPrice = Number((item.total - couponDiscount).toFixed(2));
    });
  } else {
    cartItems.forEach((item) => {
      item.couponDiscount = 0;
      item.finalPrice = item.total;
    });
  }

  const orderShipping = amountAfterOffer > 0 && amountAfterOffer < 499 ? 49 : 0;

  const finalTotal = Math.max(
    amountAfterOffer - orderCouponDiscount + orderShipping,
    0,
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
