const mongoose = require("mongoose");
require("dotenv").config();
require("./models/User");
require("./models/Product");
require("./models/productvariant");
const Cart = require("./models/Cart");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const carts = await Cart.find({ "items.0": { $exists: true } })
      .populate("items.product")
      .populate("items.variant")
      .lean();
    console.log(JSON.stringify(carts, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit();
});
