

const Cart    = require('../models/Cart');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const User    = require('../models/User');
const Address=require("../models/address");
const Offer = require("../models/Offer");
const ProductVariant = require('../models/productvariant');
const Wallet  = require('../models/Wallet');
const { getBestOffer } = require("../utils/offerHelper");
const calculateCheckout = require("../utils/checkoutCalculator");
const { validateCoupon } = require('./couponController'); 
const Coupon= require("../models/Coupon");
const crypto = require("crypto");
const razorpay = require("../utils/razorpay");
const {
  getActiveOffers,
  calculateProductPrice,
} = require("../utils/priceHelper");



const MAX_QTY = 5;


function getUserId(req) {
  return req.session.userId || req.session.user?._id;
}

async function validateCart(cart) {
  const issues = [];
  const validItems = cart.items.filter(item => item.product !== null);
  for (const item of validItems) {
    const product = item.product;
    if (product.isBlocked || product.status === 'inactive') {
      issues.push(`"${product.name}" is no longer available.`); continue;
    }
    const variant = item.variant || null;
    const stock = Number(variant?.stockQuantity ?? product?.stock ?? 0);
    if (stock === 0)          issues.push(`"${product.name}" is out of stock.`);
    else if (item.quantity > stock) issues.push(`"${product.name}" — only ${stock} unit(s) left.`);
  }
  return issues;
}

exports.getCheckout = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.redirect("/user/login");
    }

    // Get active offers once
    const offers = await getActiveOffers();

    // Get cart
    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        populate: { path: "category", select: "name" },
      })
      .populate("items.variant")
      .lean();

    if (!cart || !cart.items.length) {
      req.flash("error", "Your cart is empty.");
      return res.redirect("/cart");
    }

    const issues = await validateCart(cart);
    const hasStockIssue = issues.length > 0;

    // ---------- Build cart items ----------
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

    // ---------- Order totals ----------
    const orderSubtotal = cartItems.reduce(
      (sum, item) => sum + item.originalPrice * item.quantity,
      0
    );

    const orderOfferDiscount = cartItems.reduce(
      (sum, item) =>
        sum + (item.originalPrice - item.offerPrice) * item.quantity,
      0
    );

    let orderCouponDiscount = 0;

    const sessionCoupon = req.session.appliedCoupon || null;

    if (sessionCoupon) {
      orderCouponDiscount = sessionCoupon.discountAmount || 0;
    }

    const orderShipping =
      orderSubtotal - orderOfferDiscount >= 499 ? 0 : 49;

    const finalTotal = Math.max(
      orderSubtotal -
        orderOfferDiscount -
        orderCouponDiscount +
        orderShipping,
      0
    );

    // ---------- Addresses ----------
    const addresses = await Address.find({ user: userId })
      .sort({ createdAt: -1 });

    // ---------- Wallet ----------
    const wallet = await Wallet.findOne({ user: userId }).lean();

    const walletBalance = wallet?.balance || 0;

    // ---------- Coupons ----------
    const availableCoupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gte: new Date() },
      minPurchase: {
        $lte: orderSubtotal - orderOfferDiscount,
      },
    }).lean();

    res.render("user/orders/checkout", {
      cartItems,

      addresses,
      walletBalance,
      availableCoupons,
      sessionCoupon,

      orderSubtotal,
      orderOfferDiscount,
      orderCouponDiscount,
      orderShipping,
      finalTotal,

      cartCount: cartItems.length,
      hasStockIssue,

      success: req.flash("success"),
      error: hasStockIssue ? [issues[0]] : req.flash("error"),
    });

  } catch (err) {
    console.error("checkoutController.getCheckout:", err);
    res.status(500).send(err.message);
  }
};
/* ═══════════════════════════════════════════
   APPLY COUPON (AJAX — called from checkout.ejs)
═══════════════════════════════════════════ */
exports.applyCoupon = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { code, subtotal } = req.body; // subtotal = amount AFTER offer discount, sent by the front-end

    if (!code) {
      return res.json({ success: false, message: 'Please enter a coupon code' });
    }

    const result = await validateCoupon(code, userId, Number(subtotal) || 0);

    if (!result.valid) {
      return res.json({ success: false, message: result.message });
    }

    req.session.appliedCoupon = {
      code: result.coupon.code,
      discountAmount: result.discountAmount,
    };

    return res.json({
      success: true,
      code: result.coupon.code,
      discountAmount: result.discountAmount,
    });
  } catch (err) {
    console.error('applyCoupon error:', err);
    return res.json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/* ═══════════════════════════════════════════
   REMOVE COUPON
═══════════════════════════════════════════ */
exports.removeCoupon = async (req, res) => {
  try {
    delete req.session.appliedCoupon;
    return res.json({ success: true });
  } catch (err) {
    console.error('removeCoupon error:', err);
    return res.json({ success: false, message: 'Could not remove coupon' });
  }
};


exports.buyNow = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.redirect("/user/login");
    }

if (req.session.buyNowItem) {

  const buy = req.session.buyNowItem;

  const product = await Product.findById(buy.product)
    .populate("category")
    .lean();

  if (!product) {
    delete req.session.buyNowItem;
    req.flash("error", "Product not found.");
    return res.redirect("/products");
  }

  const variant = buy.variant
    ? await ProductVariant.findById(buy.variant).lean()
    : null;

  const stock = Number(
    variant?.stockQuantity ?? product.stock ?? 0
  );

  if (stock < buy.quantity) {
    delete req.session.buyNowItem;
    req.flash("error", "Product is out of stock.");
    return res.redirect("/products");
  }

  const unitPrice = variant
    ? (variant.discountPrice || variant.price || 0)
    : (product.price || 0);

  const subtotal = unitPrice * buy.quantity;

  const addresses = await Address.find({
    user: userId
  }).sort({ createdAt: -1 });

  return res.render("user/orders/checkout", {

    cartItems: [{
      product,
      variant,
      quantity: buy.quantity
    }],

    addresses,

    subtotal,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: subtotal,

    cartCount: 1,

    hasStockIssue: false,

    success: req.flash("success"),
    error: req.flash("error")

  });

}

    const { productId, variantId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    const product = await Product.findById(productId);

    if (!product) {
      req.flash("error", "Product not found.");
      return res.redirect("back");
    }

    const variant = variantId
      ? await ProductVariant.findById(variantId)
      : null;

    const stock = Number(
      variant?.stockQuantity ?? product.stock ?? 0
    );

    if (stock < qty) {
      req.flash("error", `Only ${stock} units available.`);
      return res.redirect("back");
    }

    req.session.buyNowItem = {
      product: productId,
      variant: variantId || null,
      quantity: qty
    };

    res.redirect("/checkout");
  } catch (err) {
    console.error(err);
    res.redirect("back");
  }
};

exports.checkCartStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ issues: ['User not logged in'] });
    const cart = await Cart.findOne({ user: userId })
      .populate({ path: 'items.product', populate: { path: 'category', select: 'name' } })
      .populate('items.variant')
      .lean();
    if (!cart) return res.json({ issues: [] });
    const issues = await validateCart(cart);
    return res.json({ issues });
  } catch (err) {
    console.error('checkoutController.checkCartStatus:', err);
    return res.status(500).json({ issues: ['Server error'] });
  }
};



  async function createOrder({
    userId,
    addressId,
    paymentMethod,
    paymentStatus,
    subtotal,
    discount,
    shipping,
    tax,
    total
}) {
  const address = await Address.findOne({
  _id: addressId,
  user: userId
}).lean();

if (!address) {
    throw new Error("Invalid address");
}

  // Fetch + validate cart
    const cart = await Cart
      .findOne({ user: userId })
      .populate('items.product')
      .populate('items.variant')
      .lean();

if (!cart || !cart.items.length) {
    throw new Error("Your cart is empty.");
}


const validItems = cart.items.filter(item => item.product);


   const issues = await validateCart(cart);
    if (issues.length > 0) {
    throw new Error(issues[0]);
}

const offers = await getActiveOffers();
const orderItems = validItems.map(item => {

    const product = item.product;
    const variant = item.variant;

    const price = calculateProductPrice(
        product,
        variant,
        offers
    );

    return {
        product: product._id,
        variantId: variant?._id,

        name: product.name,
        image: variant?.images?.[0] || null,
        size: variant?.size || null,
        color: variant?.color || null,

        // save the actual selling price
        price: price.offerPrice,

        // optional but recommended
        originalPrice: price.originalPrice,
        offerDiscount: price.offerDiscount,
        savings: price.savings,

        quantity: item.quantity,
        total: price.offerPrice * item.quantity,
    };

});
 const orderId = 'LF-' + Date.now().toString(36).toUpperCase();


   const order = new Order({
      user:          userId,
      orderId,
      items:         orderItems,

     address: {
  fullName: address.name,
  phone: address.phone,
  addressLine1: address.street,
  addressLine2: address.line2,
  city: address.city,
  state: address.state,
  pincode: address.zip,
  country: address.country
},
      paymentMethod,
      paymentStatus,
      orderStatus:   'pending',
      subtotal:      parseFloat(subtotal) || 0,
      discount:      parseFloat(discount) || 0,
      shipping:      parseFloat(shipping) || 0,
      tax:           parseFloat(tax)      || 0,
      total:         parseFloat(total)    || 0,
    });

    await order.save();

     for (const item of validItems) {
      const product = item.product;
      if (item.variant) {
        await ProductVariant.updateOne(
          { _id: item.variant._id },
          { $inc: { stockQuantity: -item.quantity } }
        );
      } else {
        await Product.updateOne(
          { _id: product._id },
          { $inc: { stock: -item.quantity } }
        );
      }
    }

     await Cart.findOneAndUpdate(
  { user: userId },
  { $set: { items: [] } }
);

return order;

}



function generateTransactionId() {
  return `TXN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}




exports.placeOrder = async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
    
    const userId = getUserId(req);

    if (!userId) {
      return res.redirect("/user/login");
    }

    const cart = await Cart.findOne({ user: userId }).populate("items.product");

// const subtotal = calculateSubtotal(cart);
// const shipping = calculateShipping(cart);
// const discount = calculateDiscount(cart);
// const tax = calculateTax(cart);

// // const total = subtotal + shipping + tax - discount;

      const total = Number(req.body.total);
      if (isNaN(total)) {
        req.flash('error', 'Invalid total amount.');
        return res.redirect('/checkout');
      }

    const {
      addressId,
      paymentMethod,
      subtotal,
      discount,
      shipping,
      tax,
    } = req.body;

    if (!addressId) {
      req.flash("error", "Please select a delivery address.");
      return res.redirect("/checkout");
    }

    if (!["cod", "wallet", "online"].includes(paymentMethod)) {
      req.flash("error", "Invalid payment method.");
      return res.redirect("/checkout");
    }

    let paymentStatus = "pending";
    let wallet = null;

    // Check wallet balance first
    if (paymentMethod === "wallet") {
      wallet = await Wallet.findOne({ user: userId });

      if (!wallet) {
        req.flash("error", "Wallet not found.");
        return res.redirect("/checkout");
      }

      if (wallet.balance < Number(total)) {
        req.flash("error", "Insufficient wallet balance.");
        return res.redirect("/checkout");
      }

      paymentStatus = "paid";
    }

    // Create Order
    const order = await createOrder({
      userId,
      addressId,
      paymentMethod,
      paymentStatus,
      subtotal,
      discount,
      shipping,
      tax,
      total,
    });

    // Wallet payment
    if (paymentMethod === "wallet") {
      wallet.balance -= Number(total);

      console.log({
  type: "debit",
  amount: Number(total),
  reason: "Order Payment",
  transactionId: generateTransactionId(),
  orderId: order._id,
});

console.log("total =", total);
console.log("Number(total) =", Number(total));

      wallet.transactions.push({
        type: "debit",
        amount: Number(total),
        reason: "Order Payment",
        transactionId: generateTransactionId(),
        orderId: order._id,
      });

      await wallet.save();
    }

    req.session.cartCount = 0;

    return res.redirect(`/checkout/success/${order._id}`);
  } catch (err) {
    console.error("Place Order Error:", err);
    req.flash("error", err.message);
    return res.redirect("/checkout/order-failed");
  }
};


exports.orderFailed = async (req, res) => {
  try {
    // Optional: fetch any needed data, but usually just render a simple message
    res.render('user/orders/orderFailed', {
      error: req.flash ? req.flash('error') : [],
    });
  } catch (err) {
    console.error('checkoutController.orderFailed:', err);
    res.status(500).render('error', { message: 'Could not load order failure page.' });
  }
};






exports.getOrderSuccess = async (req, res) => {
  try {
    const userId  = getUserId(req);
    const { orderId } = req.params;

    const order = await Order
      .findById(orderId)
      .populate('items.product', 'name images')
      .lean();

    if (!order || order.user.toString() !== userId.toString()) {
      return res.redirect('/products');
    }

    // Enrich items with variant info
    const items = order.items.map(item => ({
      ...item,
      product: item.product,
      variant: null, // variant info stored inline in order
    }));

    const user = await User.findById(userId).select('firstName lastName').lean();

    res.render('user/orders/orderSuccess', {
      orderData: {
        ...order,
        orderId:  order.orderId || order._id.toString().slice(-8).toUpperCase(),
        items,
        user,
      },
    });
  } catch (err) {
    console.error('checkoutController.getOrderSuccess:', err);
    res.redirect('/products');
  }
};

exports.getOrders = async (req, res) => {
  try {
    const userId = getUserId(req);

    const orders = await Order.find({
      user: userId
    })
      .sort({ createdAt: -1 })
      .lean();

    res.render('user/orders', {
      orders
    });

  } catch (err) {
    console.error('getOrders:', err);
    res.redirect('/profile');
  }
};


exports.addAddress = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const {
      fullName,
      phone,
      label,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country,
      isDefault
    } = req.body;

    if (
      !fullName ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !pincode
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    if (isDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

    const address = new Address({
      user: userId,
      label: label || 'Home',
      name: fullName,
      street: addressLine1,
      line2: addressLine2 || '',
      city,
      state,
      zip: pincode,
      country: country || 'India',
      phone,
      isDefault: !!isDefault
    });

    await address.save();

    res.json({
      success: true,
      message: 'Address added successfully'
    });

  } catch (err) {
    console.error('addAddress error:', err);

    res.status(500).json({
      success: false,
      message: err.message
      
    });
  }
};

// ── EDIT ADDRESS VIA CHECKOUT ────────────────────
exports.editAddress = async (req, res) => {
  try {
    const userId = getUserId(req);
    const addressId = req.params.addressId;
    const {
      fullName,
      phone,
      label,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country,
      isDefault,
    } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields',
      });
    }

    if (isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const updateData = {
      name: fullName,
      phone,
      label: label || 'Home',
      street: addressLine1,
      line2: addressLine2 || '',
      city,
      state,
      zip: pincode,
      country: country || 'India',
      isDefault: !!isDefault,
    };

    await Address.findByIdAndUpdate(addressId, updateData);

    res.json({ success: true, message: 'Address updated successfully' });
  } catch (err) {
    console.error('editAddress error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first."
      });
    }

    // Calculate total amount from your cart
    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("items.variant")
      .lean(); 

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: false,
        message: "Cart is empty."
      });
    }
const offers = await getActiveOffers();

const checkoutData = await calculateCheckout(
  cart,
  offers,
  req.session.appliedCoupon
);

const {
  orderSubtotal,
  orderOfferDiscount,
  orderCouponDiscount,
  orderShipping,
  finalTotal,
} = checkoutData;

console.log({
  orderSubtotal,
  orderOfferDiscount,
  orderCouponDiscount,
  orderShipping,
  finalTotal,
});

const options = {
  amount: Math.round(Number(finalTotal) * 100), // paise
  currency: "INR",
  receipt: `order_${Date.now()}`,
};

console.log(options);


const razorpayOrder = await razorpay.orders.create(options);

    res.json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrder
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to create Razorpay order."
    });
  }
};


exports.verifyRazorpayPayment = async (req, res) => {
  try {

    const userId = getUserId(req);

if (!userId) {
  return res.status(401).json({
    success: false,
    message: "Please login first."
  });
}

    const crypto = require("crypto");

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderPayload
    } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.json({
        success: false,
        message: "Payment verification failed."
      });
    }


const order = await createOrder({
    userId,
    addressId: orderPayload.addressId,
    paymentMethod: "online",
    paymentStatus: "paid",
    subtotal: orderPayload.subtotal,
    discount: orderPayload.discount,
    shipping: orderPayload.shipping,
    tax: orderPayload.tax,
    total: orderPayload.total,
});

req.session.cartCount = 0;

console.log("Created Order:", order);

return res.json({
    success: true,
    orderId: order._id,
});


  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false
    });
  }
};
