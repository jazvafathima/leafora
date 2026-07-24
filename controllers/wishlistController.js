const Product = require("../models/Product");
const Cart = require("../models/Cart");
const ProductVariant = require("../models/productvariant");
const Wishlist = require("../models/wishlist");
const MAX_QTY_PER_ITEM = 5;
const {
  getActiveOffers,
  calculateProductPrice,
} = require("../utils/priceHelper");

exports.getWishlist = async (req, res) => {
  try {
    console.log("✅ getWishlist controller called");

    const userId = req.session.userId || req.session.user?._id;

    if (!userId) {
      return res.redirect("/user/login");
    }

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: "items.product",
        populate: {
          path: "category",
          select: "name",
        },
      })
      .lean();

    if (!wishlist) {
      return res.render("user/wishlist", {
        wishlistItems: [],
        cartCount: req.session.cartCount || 0,
        success: req.flash ? req.flash("success") : [],
        error: req.flash ? req.flash("error") : [],
      });
    }

    const wishlistItems = await Promise.all(
      wishlist.items.map(async (item) => {
        const product = item.product;

        const variant =
          item.variant ||
          (await ProductVariant.findOne({
            productId: product._id,
          }).lean());

        return {
          _id: product._id,
          product,
          variant,
          addedAt: item.addedAt,
        };
      }),
    );

    res.render("user/wishlist", {
      wishlistItems,
      cartCount: req.session.cartCount || 0,
      success: req.flash ? req.flash("success") : [],
      error: req.flash ? req.flash("error") : [],
    });
  } catch (err) {
    console.error("wishlistController.getWishlist:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const { productId } = req.body;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        items: [],
      });
    }

    const index = wishlist.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    let action;

    if (index > -1) {
      wishlist.items.splice(index, 1);
      action = "removed";
    } else {
      wishlist.items.push({
        product: productId,
      });

      action = "added";
    }

    await wishlist.save();

    res.json({
      success: true,
      action,
      inWishlist: action === "added",
      wishlistCount: wishlist.items.length,
      message:
        action === "added" ? "Added to wishlist" : "Removed from wishlist",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.body;

    await Wishlist.updateOne(
      { user: userId },
      {
        $pull: {
          items: {
            product: productId,
          },
        },
      },
    );

    return res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.addToCartFromWishlist = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Please login first." });
    }

    const { productId, variantId, quantity = 1 } = req.body;
    const qty = parseInt(quantity) || 1;

    // ── Validate product ──────────────────────────────────────
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    if (
      product.isBlocked ||
      product.status === "inactive" ||
      product.status === "blocked"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "This product is no longer available.",
        });
    }

    // Resolve variant
    const variant = variantId
      ? product.variants?.find((v) => v._id?.toString() === variantId)
      : product.variants?.[0] || null;
    const stock = Number(variant?.stockQuantity || 0);

    if (stock <= 0) {
      return res.status(400).json({
        success: false,
        message: "This product is out of stock.",
      });
    }

    if (qty > stock) {
      return res
        .status(400)
        .json({ success: false, message: `Only ${stock} units available.` });
    }

    // ── Add to cart ───────────────────────────────────────────
    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });

    const existingIdx = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        (item.variantId?.toString() || "") === (variantId?.toString() || ""),
    );

    if (existingIdx > -1) {
      const newQty = cart.items[existingIdx].quantity + qty;
      if (newQty > stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock} units available. You already have ${cart.items[existingIdx].quantity} in cart.`,
        });
      }
      if (newQty > MAX_QTY_PER_ITEM) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_QTY_PER_ITEM} units per item allowed.`,
        });
      }
      cart.items[existingIdx].quantity = newQty;
    } else {
      if (qty > MAX_QTY_PER_ITEM) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_QTY_PER_ITEM} units per item allowed.`,
        });
      }
      cart.items.push({
        product: productId,
        variantId: variantId || null,
        quantity: qty,
      });
    }

    await cart.save();

    // ── Remove from wishlist ──────────────────────────────────
    await Wishlist.findOneAndUpdate(
      { user: userId },
      {
        $pull: {
          items: {
            product: productId,
          },
        },
      },
    );

    req.session.cartCount = cart.items.length;

    res.json({
      success: true,
      message: "Added to cart and removed from favorites!",
      cartCount: cart.items.length,
    });
  } catch (err) {
    console.error("wishlistController.addToCartFromWishlist:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

//  GET /wishlist/count  — AJAX cart count refresh
exports.getWishlistCount = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;

    if (!userId) {
      return res.json({ count: 0 });
    }

    const wishlist = await Wishlist.findOne({ user: userId })
      .select("items")
      .lean();

    res.json({
      count: wishlist?.items?.length || 0,
    });
  } catch (err) {
    console.error(err);
    res.json({ count: 0 });
  }
};
