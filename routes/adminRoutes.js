const express=require('express');
const router=express.Router();
const adminController=require('../controllers/adminController');

router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
// router.get('/dashboard', adminController.dashboard);

router.patch('/block-user/:id', adminController.blockUser);
router.patch('/unblock-user/:id', adminController.unblockUser);

module.exports=router;

