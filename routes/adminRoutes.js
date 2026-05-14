const express = require('express');
const router = express.Router();

console.log("ADMIN ROUTES LOADED");

const adminController = require('../controllers/adminController');
const { isAdminLoggedIn, checkAuth } = require('../middleware/adminAuth');

// LOGIN
router.get('/login', checkAuth ,adminController.loadLogin);
router.post('/login', adminController.login);

// DASHBOARD
router.get('/dashboard', isAdminLoggedIn, (req, res) => {
  res.render('admin/dashboard');
});

// USERS
router.get('/users', isAdminLoggedIn, adminController.getUsers);

// BLOCK / UNBLOCK
router.post('/users/:id/block', isAdminLoggedIn, adminController.blockUser);
router.post('/users/:id/unblock', isAdminLoggedIn, adminController.unblockUser);

router.get('/logout', isAdminLoggedIn, adminController.logout);
router.get('/testlogout', (req, res) => {
  res.send("LOGOUT ROUTE WORKING");
});

module.exports = router;

