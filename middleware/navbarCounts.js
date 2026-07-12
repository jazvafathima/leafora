

const Cart = require("../models/Cart");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    const userId = req.session?.userId || req.session?.user?._id;

    if (!userId) {
      return next();
    }

    const cart = await Cart.findOne({ user: userId }).lean();

    res.locals.cartCount = cart
      ? cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
      : 0;

    const user = await User.findById(userId)
      .select("wishlist")
      .lean();


    res.locals.wishlistCount = user?.wishlist?.length || 0;

    next();
  } catch (err) {
    console.error(err);
    next();
  }
};