const express = require('express');
const router = express.Router();


const adminController = require('../controllers/adminController');
const { isAdminLoggedIn, checkAuth } = require('../middleware/adminAuth');
const categoryController=require('../controllers/categoryController');
const productController=require('../controllers/productController');

const upload=require('../config/multer');

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



// ================product===========================


router.get("/products", productController.getProducts);

router.get("/products/add", productController.getAddProduct);
router.post("/products", upload.any(), productController.createProduct);

router.get("/products/:id/edit", productController.getEditProduct);
router.put("/products/:id", upload.any(), productController.updateProduct);

router.post("/products/:id/block", productController.blockProduct);
router.post("/products/:id/unblock",productController.unblockProduct);

router.get("/products/:id/variants", productController.getVariants);

router.post("/products/:id/variants", upload.array("images"), productController.addVariant);

router.put("/variants/:id", productController.updateVariant);
router.delete("/variants/:id", productController.deleteVariant);

// ==============logout================
router.get('/logout', isAdminLoggedIn, adminController.logout);
router.get('/testlogout', (req, res) => {
  res.send("LOGOUT ROUTE WORKING");
});

module.exports = router;

