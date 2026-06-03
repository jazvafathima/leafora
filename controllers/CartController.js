const Cart = require("../models/Cart");
const Product = require("../models/Product");
const User = require("../models/User");
const productvariant = require("../models/productvariant");
const ProductVariant = require("../models/productvariant");

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
function calcSubtotal(items) {
  return items.reduce((sum, item) => {
    if (
      !item.product ||
      item.product.isBlocked ||
      item.product.status === "inactive"
    ) {
      return sum;
    }

    const variant = item.variant || null;

    const unitPrice = variant
      ? variant.discountPrice || variant.price || 0
      : item.product.price || 0;

    const stock = Number(
      variant?.stockQuantity ?? // since separate collection
        item.product?.stock ?? // fallback if exists
        0,
    );

    if (stock === 0) return sum;

    return sum + unitPrice * item.quantity;
  }, 0);
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

        return {
          ...item,
          product,
          variant,
          stock,
        };
      }),
    );
    console.log(enriched);
    res.render("user/cart", {
      cartItems: enriched,
      success: req.flash ? req.flash("success") : [],
      error: req.flash ? req.flash("error") : [],
      cartCount: enriched.length,
    });
  } catch (err) {
    console.error("cartController.getCart:", err);
    res.status(500).render("error", { message: "Could not load cart." });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /cart/add  — Add product to cart
//  i.  Prevent adding blocked/unlisted products
//  ii. Increase quantity if already in cart
//  iii.Remove from wishlist when added to cart
//  iv. Validate stock
// ─────────────────────────────────────────────────────────────
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

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    // i. Block check
    if (
      product.isBlocked ||
      product.status === "inactive" ||
      product.status === "blocked"
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

    console.log("variant:", variant);

    console.log("productId:", productId);
    console.log("variantId:", variantId);
    console.log("variant:", variant);

    const stock = Number(variant?.stockQuantity ?? 0);

    console.log("stock:", stock);

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
    const existingIdx = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        (item.variant?.toString() || "") === (variantId?.toString() || ""),
    );

    if (existingIdx > -1) {
      const newQty = cart.items[existingIdx].quantity + qty;

      // Stock validation
      if (newQty > stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock} units available. You already have ${cart.items[existingIdx].quantity} in cart.`,
        });
      }

      // Max qty cap
      if (newQty > MAX_QTY_PER_ITEM) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_QTY_PER_ITEM} units per item allowed.`,
        });
      }

      cart.items[existingIdx].quantity = newQty;
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
    await User.findByIdAndUpdate(userId, {
      $pull: { wishlist: productId },
    });

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

    req.flash && req.flash("success", "Item added to cart!");
    res.redirect("/cart");
  } catch (err) {
    console.error("cartController.addToCart:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error. Please try again." });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /cart/update  — Increment / decrement with validations
//  v. Increment/decrement quantity with stock validations
//  vi. Maximum quantity limits
// ─────────────────────────────────────────────────────────────
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

    const cart = await Cart.findOne({ user: userId }).populate(
      "items.product",
    );

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found." });

    const item = cart.items.id(itemId);
    console.log(item);
    if (!item)
      return res
        .status(404)
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

    if (newQty > stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} units available.`,
      });
    }

    // Update quantity
    item.quantity = newQty;
    await cart.save();

    // Recalculate totals
    const unitPrice = variant
      ? variant.discountPrice || variant.price || 0
      : product.price || 0;
    const itemTotal = unitPrice * newQty;

    // Full subtotal
    const populated = await Cart.findOne({ user: userId }).populate([
      { path: "items.product" },
      { path: "items.variant" },
    ]);
    const subtotal = calcSubtotal(populated.items);

    req.session.cartCount = cart.items.length;

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

    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found." });

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
    await cart.save();

    const subtotal = calcSubtotal(cart.items);
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
    if (!userId) return res.json({ count: 0 });

    const cart = await Cart.findOne({ user: userId }).select("items").lean();
    const count = cart ? cart.items.length : 0;
    req.session.cartCount = count;
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
};

// ─────────────────────────────────────────────────────────────
//  Middleware: validate cart before checkout
//  vii. Disable out-of-stock products and restrict checkout
// ─────────────────────────────────────────────────────────────
exports.validateCartForCheckout = async (req, res, next) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId) return res.redirect("/user/login");

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .lean();

    if (!cart || cart.items.length === 0) {
      req.flash && req.flash("error", "Your cart is empty.");
      return res.redirect("/cart");
    }

    const issues = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product) {
        issues.push("A product in your cart no longer exists.");
        continue;
      }

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
      const variant = item.variant
        ? product.variants?.find(
            (v) => v._id?.toString() === item.variant?.toString(),
          )
        : product.variants?.[0] || null;

      const stock = Number(variant?.stock ?? product?.stock ?? 0);

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
