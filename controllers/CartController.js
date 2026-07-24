const Cart = require("../models/Cart");
const Product = require("../models/Product");
const User = require("../models/User");
const Offer = require("../models/Offer");
const productvariant = require("../models/productvariant");
const ProductVariant = require("../models/productvariant");
const Category=require("../models/Category")
const { getBestOffer } = require("../utils/offerHelper");
const {
  getActiveOffers,
  calculateProductPrice,
} = require("../utils/priceHelper");

const MAX_QTY_PER_ITEM = 5; // maximum quantity per cart item

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
    await cart.save();
  }
  return cart;
}

// ─────────────────────────────────────────────────────────────
//  Helper: calculate cart subtotal (only valid items)
// ─────────────────────────────────────────────────────────────
async function calcSubtotal(items) {
  const offers = await Offer.find({
    isActive: true,
    isDeleted: false,
  }).lean();

  let subtotal = 0;

  for (const item of items) {
    if (!item.product) continue;
    const offer = getBestOffer(item.product, offers);

    const price = item.variant?.discountPrice || item.variant?.price || 0;

    const finalPrice = offer.hasOffer
      ? price - Math.round((price * offer.discountPercent) / 100)
      : price;

    subtotal += finalPrice * item.quantity;
  }
  for (const item of items) {
    console.log("Product:", item.product);
    console.log("Variant:", item.variant);
  }
  return subtotal;
}

// ─────────────────────────────────────────────────────────────
//  GET /cart  — Render cart page
// ─────────────────────────────────────────────────────────────
exports.getCart = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId) return res.redirect("/user/login");

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        populate: { path: "category", select: "name" },
      })
      .lean();

    const offers = await getActiveOffers();

    // Filter out items where product was deleted from DB entirely
    const cartItems = cart
      ? cart.items.filter((item) => item.product !== null)
      : [];

    // Enrich each item with resolved variant info
    const enriched = await Promise.all(
      cartItems.map(async (item) => {
        const product = item.product;

        const variant = item.variant
          ? await ProductVariant.findById(item.variant).lean()
          : null;

        const stock = variant?.stockQuantity || 0;

        const price = calculateProductPrice(product, variant, offers);

        return {
          ...item,
          product,
          variant,
          stock,

          hasOffer: offers.hasOffer,
          offerPercent: offers.discountPercent,

          ...price,

          finalPrice: price.offerPrice,
          itemTotal: price.offerPrice * item.quantity,
        };
      }),
    );

    console.log(enriched);

    res.render("user/cart", {
      cartItems: enriched,
      success: req.flash ? req.flash("success") : [],
      cartCount: enriched.length,
    });
  } catch (err) {
    console.error("cartController.getCart:", err);
    res.status(500).render("error", { message: "Could not load cart." });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add items to cart.",
      });
    }

    const { productId, variantId, quantity = 1 } = req.body;
    const qty = parseInt(quantity) || 1;

    // ── Fetch & validate product ──
    const product = await Product.findById(productId).lean();
    const category = await Category.findById(product.category);

    if (!product) {
      return res
        .status(404)
        .render("user/404")
        .json({ success: false, message: "Product not found." });
    }

    // i. Block check
    if (
  product.isBlocked ||
  product.status === "inactive" ||
  product.status === "blocked" ||
  !product.category?.isActive ||
  product.category?.isDeleted
) {
  return res.status(400).json({
    success: false,
    message: "This product is currently unavailable.",
  });
}



    // Resolve variant
    let variant = null;

    if (variantId) {
      variant = await ProductVariant.findById(variantId).lean();
    }

    const stock = Number(variant?.stockQuantity ?? product.stock ?? 0);

    if (stock <= 0) {
      console.log("OUT OF STOCK CHECK FAILED");
      return res.status(400).json({
        success: false,
        message: "This product is out of stock.",
      });
    }

    // ── Get / create cart ──
    const cart =
      (await Cart.findOne({ user: userId })) ||
      new Cart({ user: userId, items: [] });

    // ii. If already in cart → increment quantity

    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.product?.toString() === productId &&
        item.variant?.toString() === variantId,
    );

    if (existingItemIndex > -1) {
      const newQty = cart.items[existingItemIndex].quantity + qty;

      // Stock validation
      if (newQty > stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock} units available. You already have ${cart.items[existingItemIndex].quantity} in cart.`,
        });
      }

      // Max qty cap
      if (newQty > MAX_QTY_PER_ITEM) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_QTY_PER_ITEM} units per item allowed.`,
        });
      }

      cart.items[existingItemIndex].quantity = newQty;
    } else {
      // Validate requested quantity
      if (qty > stock) {
        return res
          .status(400)
          .json({ success: false, message: `Only ${stock} units available.` });
      }
      if (qty > MAX_QTY_PER_ITEM) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_QTY_PER_ITEM} units per item allowed.`,
        });
      }

      cart.items.push({
        product: productId,
        variant: variantId || null,
        quantity: qty,
      });
    }

    await cart.save();

    // iii. Remove from wishlist if present
    await User.updateOne({ _id: userId }, { $pull: { wishlist: productId } });
    // Update session cart count
    req.session.cartCount = cart.items.length;

    // JSON response (for AJAX add-to-cart on product detail page)
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({
        success: true,
        message: "Added to cart!",
        cartCount: cart.items.length,
      });
    }

    // req.flash && req.flash("success", "Item added to cart!");
    // res.redirect("/cart")

    return res.json({
      success: true,
      message: "Added to cart",
      cartCount: cart.items.length,
    });
  } catch (err) {
    console.error("cartController.addToCart:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error. Please try again." });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });

    const { itemId, quantity } = req.body;
    const newQty = parseInt(quantity);

    if (!newQty || newQty < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid quantity." });
    }
    if (newQty > MAX_QTY_PER_ITEM) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_QTY_PER_ITEM} units per item allowed.`,
      });
    }

    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart)
      return res
        .status(404)
        .render("user/404")
        .json({ success: false, message: "Cart not found." });

    const item = cart.items.id(itemId);
    console.log(item);
    if (!item)
      return res
        .status(404)
        .render("user/404")
        .json({ success: false, message: "Item not found in cart." });

    const product = item.product;

    // Re-check product is still available
    if (!product || product.isBlocked || product.status === "inactive") {
      return res
        .status(400)
        .json({ success: false, message: "Product is no longer available." });
    }

    // Resolve variant & check stock
    const variant = await productvariant.findById(item.variant);
    // const variant = item.variant
    //   ? product.variants?.find(v => v._id?.toString() === item.variant?.toString())
    //   : product.variants?.[0] || null;

    const stock = Number(variant?.stockQuantity ?? product?.stock ?? 0);

    if (stock === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Product is out of stock." });
    }

    // Current quantity already in cart
    const currentQty = item.quantity;

    // Allow reductions even when cart quantity exceeds stock
    if (newQty > stock && newQty > currentQty) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} units available.`,
      });
    }

    // Update quantity
    item.quantity = newQty;
    await cart.save();

    const offers = await Offer.find({
      isActive: true,
      isDeleted: false,
    }).lean();

    // Recalculate totals
    const offer = getBestOffer(product, variant, offers);

    const unitPrice = offer.hasOffer
      ? offer.discountedPrice
      : offer.originalPrice;

    const itemTotal = unitPrice * quantity;
    // Full subtotal
    const populated = await Cart.findOne({ user: userId }).populate([
      { path: "items.product" },
      { path: "items.variant" },
    ]);
    const subtotal = await calcSubtotal(populated.items);

    req.session.cartCount = cart.items.length;
    console.log("Subtotal after remove:", subtotal);

    res.json({
      success: true,
      itemTotal,
      subtotal,
      cartCount: cart.items.length,
    });
  } catch (err) {
    console.error("cartController.updateCartItem:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /cart/remove  — Remove item from cart
// ─────────────────────────────────────────────────────────────
exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });

    const { itemId } = req.body;

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("items.variant");

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found." });

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
    await cart.save();

    const subtotal = await calcSubtotal(cart.items);
    req.session.cartCount = cart.items.length;

    return res.json({
      success: true,
      subtotal,
      cartCount: cart.items.length,
    });
  } catch (err) {
    console.error("cartController.removeCartItem:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /cart/clear  — Clear entire cart
// ─────────────────────────────────────────────────────────────
exports.clearCart = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });

    await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });
    req.session.cartCount = 0;
    delete req.session.appliedCoupon;

    res.json({ success: true, message: "Cart cleared." });
  } catch (err) {
    console.error("cartController.clearCart:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /cart/count  — Return cart item count (AJAX)
// ─────────────────────────────────────────────────────────────
exports.getCartCount = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;

    if (!userId) {
      return res.json({ count: 0 });
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.json({ count: 0 });
    }

    const count = cart.items.length;

    res.json({ count });
  } catch (err) {
    console.log(err);
    res.json({ count: 0 });
  }
};

exports.validateCartForCheckout = async (req, res, next) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId) return res.redirect("/user/login");

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("items.variant")
      .lean();

    const validItems = cart.items.filter((item) => item.product !== null);

    // Optional: could update DB here to remove null products, but memory filter is safer for now.

    if (validItems.length === 0) {
      req.flash && req.flash("error", "Your cart is empty.");
      return res.redirect("/cart");
    }

    const issues = [];

    for (const item of validItems) {
      const product = item.product;

      // Blocked / inactive
      if (
        product.isBlocked ||
        product.status === "inactive" ||
        product.status === "blocked"
      ) {
        issues.push(`"${product.name}" is no longer available.`);
        continue;
      }

      // Resolve variant
      const variant = item.variant || null;

      const stock = Number(variant?.stockQuantity ?? product?.stock ?? 0);

      // Out of stock
      if (stock === 0) {
        issues.push(`"${product.name}" is out of stock.`);
        continue;
      }

      // Quantity exceeds current stock
      if (item.quantity > stock) {
        issues.push(
          `"${product.name}" — only ${stock} unit(s) available but you have ${item.quantity} in cart.`,
        );
      }
    }

    if (issues.length > 0) {
      console.log("req.flash exists:", typeof req.flash);
      console.log("Issues:", issues);
      req.flash && req.flash("error", issues[0]);
      return res.redirect("/cart");
    }

    next();
  } catch (err) {
    console.error("cartController.validateCartForCheckout:", err);
    req.flash &&
      req.flash("error", "Cart validation failed. Please try again.");
    res.redirect("/cart");
  }
};

exports.buyNow = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;

    if (!userId) {
      return res.redirect("/user/login");
    }

    const { productId, variantId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    const product = await Product.findById(productId);

    if (!product) {
      req.flash("error", "Product not found.");
      return res.redirect("back");
    }

    if (
      product.isBlocked ||
      product.status === "inactive" ||
      product.status === "blocked"
    ) {
      req.flash("error", "Product unavailable.");
      return res.redirect("back");
    }

    let variant = null;

    if (variantId) {
      variant = await ProductVariant.findById(variantId);

      if (!variant) {
        req.flash("error", "Variant not found.");
        return res.redirect("back");
      }
    }

    const stock = Number(variant?.stockQuantity ?? product.stock ?? 0);

    if (qty > stock) {
      req.flash("error", `Only ${stock} units available.`);
      return res.redirect("back");
    }

    req.session.buyNowItem = {
      product: productId,
      variant: variantId || null,
      quantity: qty,
    };

    return res.redirect("/checkout");
  } catch (err) {
    console.error(err);
    res.redirect("back");
  }
};
