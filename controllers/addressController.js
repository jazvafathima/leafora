const Address = require('../models/address');

// ── GET ALL ADDRESSES ─────────────────────
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.session.user;

    const addresses = await Address.find({ user: userId });

    res.render('user/addresses/addresses', { addresses });
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
  res.render('user/addresses/addAddress');
};

// Save Address
exports.addAddress = async (req, res) => {
  try {
    const userId = req.session.user;

    const newAddress = new Address({
      user: userId,
      name: req.body.name,
      phone: req.body.phone,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      address: req.body.address
    });

    await newAddress.save();

    res.redirect('/addresses'); // back to address list
  } catch (err) {
   
  }
};



// ── ADD ADDRESS ───────────────────────────
exports.addAddress = async (req, res) => {
  try {
    const userId = req.session.user;

    const newAddress = new Address({
      user: userId,
      ...req.body
    });

    await newAddress.save();

    res.redirect('/user/addresses');
  } catch (err) {
    console.log(err);
    res.send("Error adding address");
  }
};

// ── EDIT ADDRESS ──────────────────────────
exports.editAddress = async (req, res) => {
  try {
    const { id } = req.params;

    await Address.findByIdAndUpdate(id, req.body);

    res.redirect('/user/addresses'); // IMPORTANT FIX
  } catch (err) {
    console.log(err);
    res.send("Error editing address");
  }
};


// ── DELETE ADDRESS ────────────────────────
exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    await Address.findByIdAndDelete(id);

    res.redirect('/user/addresses');
  } catch (err) {
    console.log(err);
    res.send("Error deleting address");
  }
};


// ── SET DEFAULT ADDRESS ───────────────────
exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { id } = req.params;

    // remove old default
    await Address.updateMany(
      { user: userId },
      { isDefault: false }
    );

    // set new default
    await Address.findByIdAndUpdate(id, {
      isDefault: true
    });

    res.redirect('/user/addresses');
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

    res.render('user/addresses/editAddress', { address });

  } catch (err) {
    console.log(err);
    res.send("Error loading edit page");
  }
};