const Admin = require('../models/admin');
const bcrypt = require('bcrypt');

exports.loadLogin = (req, res) => {
  res.render('admin/login');
};

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const admin = await Admin.findOne({ email });
//     if (!admin) {
//       return res.render('admin/login', { error: 'Invalid email' });
//     }

//     const isMatch = await bcrypt.compare(password, admin.password);
//     if (!isMatch) {
//       return res.render('admin/login', { error: 'Wrong password' });
//     }

//     // ✅ SESSION SET
//     req.session.admin = admin._id;

//     res.redirect('/admin/dashboard');
//   } catch (err) {
//     console.log(err);
//     res.send('Login error');
//   }
// };

  exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("LOGIN HIT", email, password);

    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      req.session.admin = true; // simple session

      console.log("Login success");

      return res.redirect('/admin/dashboard');
    } else {
      console.log("Invalid credentials");
      return res.render('admin/login', { error: 'Invalid credentials' });
    }

  } catch (err) {
    console.log(err);
    res.send('Login error');
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