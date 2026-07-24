const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { isAdminLoggedIn, checkAuth } = require("../middleware/adminAuth");
const categoryController = require("../controllers/categoryController");
const productController = require("../controllers/productController");
const orderCtrl = require("../controllers/orderController");
const offerController = require("../controllers/offerController");
const couponController = require("../controllers/CouponController");

const upload = require("../config/multer");

// LOGIN
router.get("/login", checkAuth, adminController.loadLogin);
router.post("/login", adminController.login);

router.use(isAdminLoggedIn);

// DASHBOARD
router.get("/dashboard", adminController.getDashboard);
router.get("/dashboard/chart", adminController.getChartData);

// USERS
router.get("/users", adminController.getUsers);

// BLOCK / UNBLOCK
router.post("/users/:id/block", adminController.blockUser);
router.post("/users/:id/unblock", adminController.unblockUser);

// =======================category=====================

router.get("/categories", categoryController.getCategories);
router.get("/categories/add", categoryController.getAddCategory);

router.get("/categories/:id/edit", categoryController.getEditCategory);
router.put("/categories/:id", categoryController.updateCategory);
router.post(
  "/categories",
  upload.single("image"),
  categoryController.addCategory,
);

router.post("/categories/:id/block", categoryController.blockCategory);

router.post("/categories/:id/unblock", categoryController.unblockCategory);
router.post("/categories/:id/delete", categoryController.deleteCategory);

// ================product===========================

router.get("/products", productController.getProducts);

router.get("/products/add", productController.getAddProduct);
router.get("/products/check-name", productController.checkProductName);
router.post("/products", upload.any(), productController.createProduct);

router.get("/products/:id/edit", productController.getEditProduct);
router.put("/products/:id", upload.any(), productController.updateProduct);

router.post("/products/:id/block", productController.blockProduct);
router.post("/products/:id/unblock", productController.unblockProduct);
router.post("/products/:id/delete", productController.deleteProduct);

router.get("/products/:id/variants", productController.getVariants);

router.post(
  "/products/:id/variants",
  upload.array("images"),
  productController.addVariant,
);

router.put("/variants/:id", productController.updateVariant);
router.delete("/variants/:id", productController.deleteVariant);

// ═══════════════════════════════════════════════════════════════
// order
// ═══════════════════════════════════════════════════════════════

// i, iv, v — List with search/filter/sort/pagination
router.get("/orders", orderCtrl.getOrders);

// ii — Order detail view
router.get("/orders/:id", orderCtrl.getadminOrderDetail);

// iii — Change full order status
router.post("/orders/:id/status", orderCtrl.updateOrderStatus);

// iii — Change individual item status
router.post("/orders/:id/items/:itemIdx/status", orderCtrl.updateItemStatus);

router.get("/returns", orderCtrl.getReturnRequests);

router.post("/returns/:orderId/:itemId/approve", orderCtrl.approveReturn);

router.post("/returns/:orderId/:itemId/reject", orderCtrl.rejectReturn);

router.get("/offers", offerController.getOffersPage);
router.post("/offers/add", offerController.addOffer);
router.post("/offers/:id/edit", offerController.editOffer);
router.post("/offers/:id/toggle", offerController.toggleOffer);
router.post("/offers/:id/delete", offerController.deleteOffer);

router.get("/coupons", couponController.getCouponsPage);
router.post("/coupons/add", couponController.addCoupon);
router.post("/coupons/:id/edit", couponController.editCoupon);
router.post("/coupons/:id/toggle", couponController.toggleCoupon);
router.post("/coupons/:id/delete", couponController.deleteCoupon);

router.get("/reports", adminController.getReports);
// router.get("/reports/download/pdf", adminController.downloadPdfReport);
// router.get("/reports/download/excel", adminController.downloadExcelReport);

router.get("/reports/export/pdf", adminController.exportSalesReportPDF);

router.get("/reports/export/excel", adminController.exportSalesReportExcel);

// ==============logout================
router.get("/logout", isAdminLoggedIn, adminController.logout);
router.get("/testlogout", (req, res) => {
  res.send("LOGOUT ROUTE WORKING");
});

module.exports = router;
