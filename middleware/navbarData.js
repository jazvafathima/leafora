const Wishlist = require("../models/wishlist");
const Cart = require("../models/Cart");

const navbarData = async (req, res, next) => {
  try {
    res.locals.wishlistCount = 0;
    res.locals.cartCount = 0;

    if (req.session.userId) {
      const wishlist = await Wishlist.findOne({
        user: req.session.userId,
      }).lean();
      res.locals.wishlistCount =
        wishlist?.items?.length || wishlist?.products?.length || 0;

      const cart = await Cart.findOne({ user: req.session.userId }).lean();
      res.locals.cartCount = cart?.items?.length || 0;
    }

    next();
  } catch (err) {
    console.error("navbarData middleware error:", err);
    next();
  }
};

module.exports = navbarData;
