const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { isAdminLoggedIn } = require('../middleware/adminAuth'); // ✅ ADD HERE
const User = require('../models/user'); 

// 🔐 Admin Login Routes
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);

// 🛡️ Protected Dashboard Route
router.get('/dashboard', isAdminLoggedIn, (req, res) => {
  res.render('admin/dashboard');
});

// GET USERS PAGE

router.get('/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }); // latest first

    res.render('admin/users', { users }); // render users page
  } catch (err) {
    console.log(err);
    res.send("Error loading users");
  }
});

// Show confirm pages
router.get('/users/:id/block-confirm', isAdminLoggedIn, (req, res) => {
  res.render('admin/block-user', { userId: req.params.id });
});
router.get('/admin/users/:id/unblock-confirm', isAdminLoggedIn, (req, res) => {
  res.render('admin/unblock-user', { userId: req.params.id });
});

// Handle POST actions
router.post('/users/:id/block', isAdminLoggedIn, adminController.blockUser);
router.post('/users/:id/unblock', isAdminLoggedIn, adminController.unblockUser);



module.exports = router;