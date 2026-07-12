

const User    = require('../models/User');
const Product = require('../models/Product');
const Cart    = require('../models/Cart');
const ProductVariant = require('../models/productvariant');
const MAX_QTY_PER_ITEM = 5;
const {
  getActiveOffers,
  calculateProductPrice,
} = require("../utils/priceHelper");







exports.getWishlist = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId) return res.redirect('/user/login');

    const user = await User
      .findById(userId)
      .populate({
        path:   'wishlist',
        populate: { path: 'category', select: 'name' },
      })
      .lean();


    if (!user) return res.redirect('/user/login');

    
   const wishlistItems = await Promise.all(
  (user.wishlist || []).map(async (product) => {

    const variant = await ProductVariant.findOne({
      productId: product._id
    }).lean();


    const offers = await getActiveOffers();
    
    return {
      _id: product._id,
      product,
      variant,
      addedAt: null
    };
  })
);

      
    res.render('user/wishlist', {
      wishlistItems,
      cartCount: req.session.cartCount || 0,
      success:   req.flash ? req.flash('success') : [],
      error:     req.flash ? req.flash('error')   : [],
    });
  } catch (err) {
    console.error('wishlistController.getWishlist:', err);
    res.status(500).render('error', { message: 'Could not load wishlist.' });
  }
};


exports.toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login first.'
      });
    }

    const { productId } = req.body;

    // Validate product
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (product.isBlocked || product.status === 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'This product is unavailable.'
      });
    }

    const user = await User.findById(userId).select('wishlist');

    const idx = user.wishlist.findIndex(
      id => id.toString() === productId
    );

    let action;

    if (idx > -1) {
      // Remove from wishlist
      user.wishlist.splice(idx, 1);
      action = 'removed';
    } else {
      // Add to wishlist
      user.wishlist.push(productId);
      action = 'added';
    }

    await user.save();

    // Updated wishlist count
    const wishlistCount = user.wishlist.length;

    return res.json({
      success: true,
      action,
      inWishlist: action === 'added',
      wishlistCount, // <-- IMPORTANT
      message:
        action === 'added'
          ? 'Added to favorites!'
          : 'Removed from favorites.'
    });

  } catch (err) {
    console.error('wishlistController.toggleWishlist:', err);

    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};



exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    const { productId } = req.body;

    await User.findByIdAndUpdate(userId, {
      $pull: { wishlist: productId },
    });

    res.json({ success: true, message: 'Removed from favorites.' });
  } catch (err) {
    console.error('wishlistController.removeFromWishlist:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};




exports.addToCartFromWishlist = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login first.' });
    }

    const { productId, variantId, quantity = 1 } = req.body;
    const qty = parseInt(quantity) || 1;

    // ── Validate product ──────────────────────────────────────
    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    if (product.isBlocked || product.status === 'inactive' || product.status === 'blocked') {
      return res.status(400).json({ success: false, message: 'This product is no longer available.' });
    }

    // Resolve variant
    const variant = variantId
      ? product.variants?.find(v => v._id?.toString() === variantId)
      : product.variants?.[0] || null;
const stock = Number(variant?.stockQuantity || 0);

if (stock <= 0) {
  return res.status(400).json({
    success: false,
    message: "This product is out of stock."
  });
}

    if (qty > stock) {
      return res.status(400).json({ success: false, message: `Only ${stock} units available.` });
    }

    // ── Add to cart ───────────────────────────────────────────
    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });

    const existingIdx = cart.items.findIndex(item =>
      item.product.toString() === productId &&
      (item.variantId?.toString() || '') === (variantId?.toString() || '')
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
        product:   productId,
        variantId: variantId || null,
        quantity:  qty,
      });
    }

    await cart.save();

    // ── Remove from wishlist ──────────────────────────────────
    await User.findByIdAndUpdate(userId, {
      $pull: { wishlist: productId },
    });

    req.session.cartCount = cart.items.length;

    res.json({
      success:   true,
      message:   'Added to cart and removed from favorites!',
      cartCount: cart.items.length,
    });
  } catch (err) {
    console.error('wishlistController.addToCartFromWishlist:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};



//  GET /wishlist/count  — AJAX cart count refresh

exports.getWishlistCount = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?._id;

    if (!userId) {
      return res.json({ count: 0 });
    }

    const user = await User.findById(userId)
      .select('wishlist')
      .lean();

    const count = user?.wishlist?.length || 0;

    res.json({ count });
  } catch (err) {
    console.error(err);
    res.json({ count: 0 });
  }
};

