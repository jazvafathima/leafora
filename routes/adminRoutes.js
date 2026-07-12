const express = require('express');
const router = express.Router();


const adminController = require('../controllers/adminController');
const { isAdminLoggedIn, checkAuth } = require('../middleware/adminAuth');
const categoryController=require('../controllers/categoryController');
const productController=require('../controllers/productController');
const orderCtrl  = require('../controllers/orderController');
const offerController = require('../controllers/offerController');
const couponController = require('../controllers/CouponController');
 
const upload=require('../config/multer');

// LOGIN
router.get('/login', checkAuth ,adminController.loadLogin);
router.post('/login', adminController.login);

// DASHBOARD
router.get("/dashboard", isAdminLoggedIn, adminController.getDashboard);
router.get("/dashboard/chart", isAdminLoggedIn, adminController.getChartData);

// USERS
router.get('/users', isAdminLoggedIn, adminController.getUsers);

// BLOCK / UNBLOCK
router.post('/users/:id/block', isAdminLoggedIn, adminController.blockUser);
router.post('/users/:id/unblock', isAdminLoggedIn, adminController.unblockUser);


// =======================category=====================



router.get('/categories', isAdminLoggedIn, categoryController.getCategories);
router.get('/categories/add', isAdminLoggedIn, categoryController.getAddCategory);

router.get('/categories/:id/edit', (req, res) => {
  console.log("EDIT ROUTE HIT WORKING");
  res.send("EDIT OK");
});
router.get('/categories/:id/edit', isAdminLoggedIn, categoryController.getEditCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.post('/categories', isAdminLoggedIn, upload.single('image'), categoryController.addCategory);

router.post('/categories/:id/block', isAdminLoggedIn, categoryController.blockCategory);

router.post('/categories/:id/unblock', isAdminLoggedIn, categoryController.unblockCategory);
router.post('/categories/:id/delete',categoryController .deleteCategory);



// ================product===========================


router.get("/products", productController.getProducts);

router.get("/products/add", productController.getAddProduct);
router.get("/products/check-name", productController.checkProductName);
router.post("/products", upload.any(), productController.createProduct);

router.get("/products/:id/edit", productController.getEditProduct);
router.put("/products/:id", upload.any(), productController.updateProduct);

router.post('/products/:id/block', productController.blockProduct);
router.post('/products/:id/unblock', productController.unblockProduct);
router.post('/products/:id/delete', productController.deleteProduct);

router.get("/products/:id/variants", productController.getVariants);

router.post("/products/:id/variants", upload.array("images"), productController.addVariant);

router.put("/variants/:id", productController.updateVariant);
router.delete("/variants/:id", productController.deleteVariant);




// ═══════════════════════════════════════════════════════════════
// order
// ═══════════════════════════════════════════════════════════════


 
// i, iv, v — List with search/filter/sort/pagination
router.get('/orders',                          isAdminLoggedIn, orderCtrl.getOrders);
 
// ii — Order detail view
router.get('/orders/:id',                       isAdminLoggedIn, orderCtrl.getadminOrderDetail);
 
// iii — Change full order status
router.post('/orders/:id/status',               isAdminLoggedIn, orderCtrl.updateOrderStatus);
 
// iii — Change individual item status
router.post('/orders/:id/items/:itemIdx/status',isAdminLoggedIn, orderCtrl.updateItemStatus);

router.get(
  "/returns",
  orderCtrl.getReturnRequests
);

router.post(
  "/returns/:orderId/:itemId/approve",
  orderCtrl.approveReturn
);

router.post(
  "/returns/:orderId/:itemId/reject",
  orderCtrl.rejectReturn
);


 
router.get('/offers',                        isAdminLoggedIn, offerController.getOffersPage);
router.post('/offers/add',                    isAdminLoggedIn, offerController.addOffer);
router.post('/offers/:id/edit',             isAdminLoggedIn, offerController.editOffer);
router.post('/offers/:id/toggle',            isAdminLoggedIn, offerController.toggleOffer);
router.post('/offers/:id/delete',             isAdminLoggedIn, offerController.deleteOffer);
 




router.get('/coupons',              isAdminLoggedIn, couponController.getCouponsPage);
router.post('/coupons/add',          isAdminLoggedIn, couponController.addCoupon);
router.post('/coupons/:id/edit',     isAdminLoggedIn, couponController.editCoupon);
router.post('/coupons/:id/toggle',   isAdminLoggedIn, couponController.toggleCoupon);
router.post('/coupons/:id/delete',   isAdminLoggedIn, couponController.deleteCoupon);
 

router.get("/reports", adminController.getReports);
// router.get("/reports/download/pdf", adminController.downloadPdfReport);
// router.get("/reports/download/excel", adminController.downloadExcelReport);


router.get(
    "/reports/export/pdf",
    adminController.exportSalesReportPDF
);

router.get(
    "/reports/export/excel",
    adminController.exportSalesReportExcel
);

// ==============logout================
router.get('/logout', isAdminLoggedIn, adminController.logout);
router.get('/testlogout', (req, res) => {
  res.send("LOGOUT ROUTE WORKING");
});

module.exports = router;

