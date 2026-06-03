const Product = require("../models/Product");
const ProductVariant = require("../models/productvariant");
const Category = require("../models/Category");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { search } = require("../routes/userRoutes");



exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;

    const stock = req.query.stock || "";
    const category = req.query.category || "";
    const search = req.query.search || "";

    // Get categories for dropdown
    const categories = await Category.find({ isDeleted: false }).lean();

    // Get products
    const products = await Product.find()
      .populate("category")
      .populate("variants")
      .sort({ createdAt: -1 })
      .lean();

    // Add totalStock
    const enrichedProducts = products.map((product) => {
      const totalStock = (product.variants || []).reduce(
        (sum, variant) => sum + (variant.stockQuantity || 0),
        0
      );

      return {
        ...product,
        totalStock,
      };
    });

    let filteredProducts = enrichedProducts;

    if (search.trim()) {
  filteredProducts = filteredProducts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
}

    // Category filter
    if (category) {
      filteredProducts = filteredProducts.filter(
        (p) => p.category && p.category._id.toString() === category
      );
    }

    // Stock filter
    if (stock === "instock") {
      filteredProducts = filteredProducts.filter(
        (p) => p.totalStock > 0
      );
    }

    if (stock === "outstock") {
      filteredProducts = filteredProducts.filter(
        (p) => p.totalStock === 0
      );
    }

    const total = filteredProducts.length;

    const paginatedProducts = filteredProducts.slice(
      (page - 1) * limit,
      page * limit
    );

    res.render("admin/product/products", {
      products: paginatedProducts,
      categories,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      selectedStock: stock,
      selectedCategory: category,
      search,
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/dashboard");
  }
};



exports.getAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({isDeleted:false});

    res.render("admin/product/addproduct", {
      categories,

    });
  } catch (error) {
    console.log(error);
    res.redirect("/products");
  }
};

exports.createProduct = async (req, res) => {
  try {

    console.log(req.files)
    const {
      name,
      category,
      shortDescription,
      fullDescription,
      status
    } = req.body;



    const product = await Product.create({
      name,
      category,
      shortDescription,
      fullDescription,
      status,
      isDeleted: false
    });

    // Handle Variants
    if (req.body.variantsData) {
      const variants = JSON.parse(req.body.variantsData);
      
      for (const v of variants) {
        const variantImagesPrefix = `variant_${v.imageIndex}_images`;
        const vImages = [];

        const vFiles = req.files.filter(f => f.fieldname === variantImagesPrefix);
        
        for (const file of vFiles) {
          const filename = "variant-" + Date.now() + "-" + file.originalname;
          const outputPath = path.join("public/uploads/products", filename);

          await sharp(file.path)
            .resize(800, 800, { fit: "cover" })
            .toFile(outputPath);

          vImages.push(filename);

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }

        await ProductVariant.create({
          productId: product._id,
          size: v.size,
          price: v.price,
          stockQuantity: Number(v.stock) || 0,
          images: vImages,
          status: "active"
        });
      }
    }
    await updateProductStock(product._id);
    async function updateProductStock(productId) {
  const variants = await ProductVariant.find({ productId });

  const stock = variants.reduce(
    (sum, v) => sum + (v.stockQuantity || 0),
    0
  );

  await Product.findByIdAndUpdate(productId, {
    stock:stock
  });
}


    res.redirect("/admin/products");

  } catch (err) {
    console.log(err);
    res.redirect("/admin/products/add");
  }
};

exports.getEditProduct = async (req, res) => {
  try {

    const product = await Product.findById(req.params.id)
      .populate("variants");

    const categories = await Category.find({
      isDeleted: false
    });

    console.log("Variants:", product.variants);

    res.render("admin/product/editProduct", {
      product,
      categories
    });

  } catch (err) {
    console.log(err);
    res.redirect("/admin/products");
  }
};


const updateProductStock = async (productId) => {
  const variants = await ProductVariant.find({ productId });
  const stock = variants.reduce(
    (sum, v) => sum + (v.stockQuantity || 0),
    0
  );
  await Product.findByIdAndUpdate(productId, { stock });
};

const processUploadedFile = async (file) => {
  const filename = "variant-" + Date.now() + "-" + file.originalname;
  const outputPath = path.join("public/uploads/products", filename);

  await sharp(file.path)
    .resize(800, 800, { fit: "cover" })
    .toFile(outputPath);

  // Remove the original uploaded file if sharp is used
  if (fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      console.error("Error unlinking original file:", e);
    }
  }
  return filename;
};

const cleanUpRemainingFiles = (files) => {
  if (files && files.length > 0) {
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { name, category, shortDescription, fullDescription, status } = req.body;

    // 1. Update basic product details
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        category,
        shortDescription,
        fullDescription,
        status: status || "active",
      },
      { new: true }
    );

    if (!product) {
      req.flash("error", "Product not found.");
      cleanUpRemainingFiles(req.files);
      return res.redirect("/admin/products");
    }

    // 2. Handle updating existing variants
    let updatedVariants = req.body.variants || [];
    if (!Array.isArray(updatedVariants)) {
      updatedVariants = Object.values(updatedVariants);
    }

    for (let vi = 0; vi < updatedVariants.length; vi++) {
      const v = updatedVariants[vi];
      if (v._id) {
        const dbVariant = await ProductVariant.findById(v._id);
        if (dbVariant) {
          // Normalize existing images to keep
          let keepImages = [];
          if (v.existingImages) {
            keepImages = Array.isArray(v.existingImages)
              ? v.existingImages
              : [v.existingImages];
          }

          // Process newly uploaded files for this existing variant
          const fieldName = `variantImages[${vi}]`;
          const vFiles = (req.files || []).filter((f) => f.fieldname === fieldName);
          const newImages = [];

          for (const file of vFiles) {
            const savedFilename = await processUploadedFile(file);
            newImages.push(savedFilename);
          }

          const finalImages = [...keepImages, ...newImages];

          // Delete removed images from disk
          const removedImages = dbVariant.images.filter((img) => !keepImages.includes(img));
          for (const img of removedImages) {
            const imgPath = path.join("public/uploads/products", img);
            if (fs.existsSync(imgPath)) {
              try {
                fs.unlinkSync(imgPath);
              } catch (e) {
                console.error("Error deleting image file:", e);
              }
            }
          }

          // Update variant properties
          dbVariant.size = v.size;
          dbVariant.price = Number(v.price) || 0;
          dbVariant.stockQuantity = Number(v.stockQuantity) || 0;
          dbVariant.status = v.status === "active" ? "active" : "inactive";
          dbVariant.images = finalImages;

          await dbVariant.save();
        }
      }
    }

    // 3. Handle creating new variants
    let newVariants = req.body.newVariants || [];
    if (!Array.isArray(newVariants)) {
      newVariants = Object.values(newVariants);
    }

    for (let nvi = 0; nvi < newVariants.length; nvi++) {
      const nv = newVariants[nvi];
      const fieldName = `newVariantImages[${nvi}]`;
      const nvFiles = (req.files || []).filter((f) => f.fieldname === fieldName);
      const nvImages = [];

      for (const file of nvFiles) {
        const savedFilename = await processUploadedFile(file);
        nvImages.push(savedFilename);
      }

      await ProductVariant.create({
        productId: req.params.id,
        size: nv.size,
        price: Number(nv.price) || 0,
        stockQuantity: Number(nv.stockQuantity) || 0,
        images: nvImages,
        status: nv.status === "active" ? "active" : "inactive",
      });
    }

    // 4. Update the overall product stock
    await updateProductStock(req.params.id);

    // Clean up any remaining unprocessed temporary uploaded files
    cleanUpRemainingFiles(req.files);

    req.flash("success", "Product updated successfully.");
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    cleanUpRemainingFiles(req.files);
    req.flash("error", "Failed to update product.");
    res.redirect(`/admin/products/${req.params.id}/edit`);
  }
};

exports.blockProduct = async (req, res) => {

  try {


    await Product.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true }
    );

    res.redirect('/admin/products');

  } catch (err) {

    console.log(err);

    res.redirect('/admin/products');
  }
};


exports.unblockProduct=async(req,res)=>{
  try{

    await Product.findByIdAndUpdate(
      req.params.id,{
        isDeleted:false
      }
    )

    res.redirect('/admin/products')

  }catch(err){
    console.log(err)

    res.redirect('/admin/products')
  }
}


exports.getVariants = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    const variants = await ProductVariant.find({
      productId: req.params.id,
    });

    res.render("admin/product/variants", {
      product,
      variants,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/admin/products");
  }
};

exports.addVariant = async (req, res) => {
  try {
    const { color, size, sku, price, discountPrice, stock, status } = req.body;

    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Use sharp to process images
        const filename = "variant-" + Date.now() + "-" + file.originalname;
        const outputPath = path.join("public/uploads/products", filename);

        await sharp(file.path)
          .resize(800, 800, { fit: "cover" })
          .toFile(outputPath);

        images.push(filename);
        
        // Optionally remove the original uploaded file if sharp is used
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    const variant = await ProductVariant.create({
      productId: req.params.id,
      color,
      size,
      sku,
      price,
      discountPrice,
      stockQuantity: stock,
      status,
      images,
    });
await updateProductStock(req.params.id);

async function updateProductStock(productId) {
  const variants = await ProductVariant.find({ productId });

  const stock = variants.reduce(
    (sum, v) => sum + (v.stockQuantity || 0),
    0
  );

  await Product.findByIdAndUpdate(productId, {
    stock:stock
  });
}

    res.redirect(`/admin/products/${req.params.id}/variants`);
  } catch (err) {
    console.log(err);
    res.redirect("back");
  }
};

exports.updateVariant = async (req, res) => {
  try {
    await ProductVariant.findByIdAndUpdate(req.params.id, req.body);

    res.redirect("/admin/products")
  } catch (err) {
    console.log(err);

    res.json({
      success: false,
    });
  }
};

exports.deleteVariant = async (req, res) => {
  try {
    const variant = await ProductVariant.findById(req.params.id);
    if (!variant) {
      return res.json({ success: false, message: "Variant not found." });
    }
    const productId = variant.productId;

    // Delete variant images from filesystem
    if (variant.images && variant.images.length > 0) {
      for (const img of variant.images) {
        const imgPath = path.join("public/uploads/products", img);
        if (fs.existsSync(imgPath)) {
          try {
            fs.unlinkSync(imgPath);
          } catch (e) {
            console.error("Error deleting variant image:", e);
          }
        }
      }
    }

    await ProductVariant.findByIdAndDelete(req.params.id);
    await updateProductStock(productId);

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);
    res.json({
      success: false,
    });
  }
};




exports.getUserProducts = async (req, res) => {
  try {
    const page     = parseInt(req.query.page)     || 1;
    const limit    = 9;
    const search   = req.query.search   || '';
    const sort     = req.query.sort     || '';
    const category = req.query.category || '';
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;

    // Base filter: only active, non-deleted products
    const filter = { isDeleted: false, status: 'active' };
    if (category) filter.category = category;
    if (search)   filter.name = { $regex: search, $options: 'i' };

    // Fetch all categories for the sidebar filter
    const categories = await Category.find({ isActive: true});

    // Get ALL matching products first (with variants) so we can filter by price
 let products = await Product.find(filter)
  .populate({
    path: 'category',
    match: { isActive: true }
  })
  .populate('variants')
  .sort({ createdAt: -1 });

products = products.filter(product => product.category);

    // Filter by price (based on the first variant's price)
    if (minPrice !== null || maxPrice !== null) {
      products = products.filter(p => {
        const v = p.variants && p.variants[0];
        if (!v) return false;
        const price = v.discountPrice || v.price || 0;
        if (minPrice !== null && price < minPrice) return false;
        if (maxPrice !== null && price > maxPrice) return false;
        return true;
      });
    }

    // Sort
    if (sort === 'price_asc') {
      products.sort((a, b) => {
        const pa = (a.variants[0] && (a.variants[0].discountPrice || a.variants[0].price)) || 0;
        const pb = (b.variants[0] && (b.variants[0].discountPrice || b.variants[0].price)) || 0;
        return pa - pb;
      });
    } else if (sort === 'price_desc') {
      products.sort((a, b) => {
        const pa = (a.variants[0] && (a.variants[0].discountPrice || a.variants[0].price)) || 0;
        const pb = (b.variants[0] && (b.variants[0].discountPrice || b.variants[0].price)) || 0;
        return pb - pa;
      });
    } else if (sort === 'name_asc') {
      products.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'name_desc') {
      products.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sort === 'newest') {
      products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const totalProducts = products.length;
    const totalPages    = Math.ceil(totalProducts / limit) || 1;
    const pagedProducts = products.slice((page - 1) * limit, page * limit);

    // Build image paths correctly (variant images stored as filenames)
    const productsWithImages = pagedProducts.map(p => {
      const pObj = p.toObject();
      // Find the first image across variants
      let imageUrl = null;
      if (pObj.variants && pObj.variants.length > 0) {
        const firstVar = pObj.variants[0];
        if (firstVar.images && firstVar.images.length > 0) {
          imageUrl = '/uploads/products/' + firstVar.images[0];
        }
      }
      pObj.images = imageUrl ? [imageUrl] : [];
      return pObj;
    });

    res.render('user/productlist', {
      products:         productsWithImages,
      categories,
      totalProducts,
      currentPage:      page,
      totalPages,
      limit,
      search,
      sort,
      selectedCategory: category,
      minPrice,
      maxPrice,
      pageTitle:        'All Plants',
    });

  } catch (err) {
    console.log(err);
    res.status(500).send('Server Error');
  }
};




exports.getProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(req.params.id)
  .populate("category")
  .populate("variants");

if (!product) {
  return res.status(404).render("user/404");
}
  const variants = await ProductVariant.find({
  productId: product._id
}).lean();

    const productObj = product.toObject();

    productObj.variants = variants;

    
    // Build images array from first variant
    if (variants.length > 0 && variants[0].images.length > 0) {
      productObj.images = variants[0].images.map(
        img => `/uploads/products/${img}`
      );
    } else {
      productObj.images = [];
    }


    const unavailable =
  product.isDeleted ||
  product.status !== "active" ||
  (product.category &&
   (product.category.isDeleted || product.category.isActive === false));

if (product.status !== "active" || product.isDeleted) {
  return res.render("user/productdetail", {
    product: productObj,
    unavailable: true,
    relatedProducts: [],
    reviews: [],
    coupons: [],
    cartCount: 0,
    inWishlist: false,
    
  
  });
}
  if (
  product.category &&
  (product.category.isDeleted || product.category.isActive === false)
) {
  return res.render("user/productdetail", {
    product: product.toObject(),
    unavailable: true,
    relatedProducts: [],
    reviews: [],
    coupons: [],
    cartCount: 0,
    inWishlist: false
  });
}

  
  variants.forEach(v => {
  console.log("stockQuantity =", v.stockQuantity);
  console.log("stock =", v.stock);
});



variants.forEach(v => {
  if ((!v.stockQuantity || v.stockQuantity === 0) && v.stock) {
    v.stockQuantity = v.stock;
  }
});

productObj.variants = variants;

productObj.stock = variants.reduce((sum, v) => {
  return sum + Number(v.stockQuantity || 0);
}, 0);

console.log("FINAL TOTAL STOCK:", productObj.stock);
console.log("VARIANTS:");
console.dir(variants, { depth: null });

    res.render("user/productdetail", {
      product: productObj,
      unavailable,
      relatedProducts: [],
      reviews: [],
      coupons: [],
      cartCount: 0,
      inWishlist: false
    });

  
  } catch (error) {
    console.error(error);
    res.redirect("/products");
  }
};