const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const User = require('../models/User');

exports.loadLogin = (req, res) => {
  res.render('admin/login');
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (email !== adminEmail || password !== adminPassword) {
      return res.render('admin/login', {
        error: "Invalid email or password"
      });
    }

    req.session.adminId = adminEmail;

// remove user session if exists
delete req.session.userId;

    return res.redirect('/admin/dashboard');

  } catch (err) {
    console.log(err);
    return res.render('admin/login', {
      error: "Something went wrong"
    });
  }
};


// ✅ BLOCK USER
exports.blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      isBlocked: true
    });

    res.redirect('/admin/users');
  } catch (err) {
    console.log(err);
    res.send("Error blocking user");
  }
};

// ✅ UNBLOCK USER
exports.unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      isBlocked: false
    });

    res.redirect('/admin/users');
  } catch (err) {
    console.log(err);
    res.send("Error unblocking user");
  }
};


exports.getUsers = async (req, res) => {
  try {
    const search = req.query.search || "";
    console.log("SEARCH:", search);

    const role = req.query.role || "";
    const status = req.query.status || "";

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    let query = {};

    // 🔍 SEARCH
    if (search.trim() !== "") {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    // 🎭 ROLE
  if (role) {
  query.role = role;
}



    // 🚦 STATUS (FIXED)
    if (status === "active") {
      query.isBlocked = false;
    }

    if (status === "blocked") {
      query.isBlocked = true;
    }



    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

 const totalPages = Math.ceil(total / limit);

res.render("admin/users", {
  users,
  search,
  role,
  status,
  currentPage: page,
  totalPages,   // ✅ correct
  totalUsers: total
});

  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};


exports.logout = (req, res) => {

  req.session.destroy((err) => {

    if (err) {
      console.log(err);
      return res.redirect('/admin/dashboard');
    }

    res.clearCookie('connect.sid');

    res.redirect('/admin/login');
  });

};