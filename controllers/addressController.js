const Address = require("../models/Address");
const Product = require("../models/Product");

// ── GET ALL ADDRESSES ─────────────────────
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.session.userId;

    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const totalAddresses = await Address.countDocuments({
      user: userId,
    });

    const totalPages = Math.ceil(totalAddresses / limit);

    const addresses = await Address.find({
      user: userId,
    })
      .sort({ isDefault: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    console.log({
      page,
      totalPages,
      addressesCount: addresses.length,
    });

    res.render("user/addresses/addresses", {
      addresses,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading addresses");
  }
};

// ── SHOW ADD ADDRESS PAGE ─────────────────
// exports.getAddAddress = (req, res) => {
//   res.render('user/addresses/addAddress');
// };
exports.getAddAddress = (req, res) => {
  console.log("Add page hit"); // 🔥 debug
  res.render("user/addresses/addAddress");
};

// Save Address

// ── EDIT ADDRESS ──────────────────────────
// Load Edit Address Page
exports.loadEditAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOne({
      _id: id,
      userId: req.session.userId, // or user: req.session.userId
    });

    if (!address) {
      res.status(404).render("user/404");
    }

    res.render("user/addresses/editaddress", { address });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading address");
  }
};

// Edit Address
exports.editAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOneAndUpdate(
      {
        _id: id,
        userId: req.session.userId,
      },
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!address) {
      res.status(404).render("user/404");
    }

    res.redirect("/addresses");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error editing address");
  }
};

// ── DELETE ADDRESS ────────────────────────
exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOneAndDelete({
      _id: id,
      userId: req.session.userId,
    });

    if (!address) {
      res.status(404).render("user/404");
    }

    res.redirect("/addresses");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error deleting address");
  }
};

// ── SET DEFAULT ADDRESS ───────────────────
exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    // remove old default
    await Address.updateMany({ user: userId }, { isDefault: false });

    // set new default
    await Address.findByIdAndUpdate(id, {
      isDefault: true,
    });

    res.redirect("/addresses");
  } catch (err) {
    console.log(err);
    res.send("Error setting default");
  }
};
exports.getEditAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findById(id);

    if (!address) {
      return res.send("Address not found");
    }

    res.render("user/addresses/editAddress", { address });
  } catch (err) {
    console.log(err);
    res.send("Error loading edit page");
  }
};
