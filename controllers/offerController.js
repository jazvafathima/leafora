const Offer    = require('../models/Offer');
const Product  = require('../models/Product');
const Category = require('../models/Category');
const { getBestOffer } = require("../utils/offerHelper");

// ─── Pricing Utility ─────────────────────────────────────────────────────────
// Export this and call it EVERYWHERE a product price is shown:
// shop listing, product detail, cart, checkout, order placement.
// Never compute discounted price in two separate places — they'll drift.

/**
 * Returns the best (highest) discount % for a product,
 * comparing its product offer vs its category offer.
 *
 * @param {Object} product  — Mongoose product doc (must have .category populated or as ObjectId)
 * @param {Array}  offers   — Array of active Offer docs (pre-fetched, not re-queried per product)
 * @returns {{ discountPercent: Number, discountedPrice: Number, originalPrice: Number }}
 */



// ─── Page: List Offers ────────────────────────────────────────────────────────
exports.getOffersPage = async (req, res) => {
  try {
    const { search = '', type = '', status = '', page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (type) query.type = type;

    // Status filter: active/inactive/expired
    const now = new Date();
    if (status === 'active') {
      query.isActive = true;
      query.endDate = { $gte: now };
    }
    if (status === 'inactive') {
      query.isActive = false;
    }
    if (status === 'expired') {
      query.endDate = { $lt: now };
    }

    const [rawOffers, totalOffers, products, categories] = await Promise.all([
      Offer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Offer.countDocuments(query),
      Product.find({ isDeleted: false }).select('name').sort('name'),
      Category.find({ isDeleted: false }).select('name').sort('name'),
    ]);

    // Attach human-readable target name to each offer for display
    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p.name]));
    const categoryMap = Object.fromEntries(categories.map(c => [c._id.toString(), c.name]));

    const offers = rawOffers.map(o => ({
      ...o.toObject(),
      targetName: o.type === 'product'
        ? (productMap[o.target?.toString()] || '—')
        : (categoryMap[o.target?.toString()] || '—'),
    }));


    res.render('admin/offers/offers', {
      offers,
      products,
      categories,
      totalOffers,
      totalPages: Math.ceil(totalOffers / limit),
      currentPage: Number(page),
      search,
      offerType: type,
      statusFilter: status,
      admin: req.session.admin,
      success: req.flash('success'),
      error: req.flash('error'),
      
    });
  } catch (err) {
    console.error('Admin offers list error:', err);
    req.flash('error', 'Failed to load offers');
    res.redirect('/admin/dashboard');
  }
};

// ─── Add Offer ────────────────────────────────────────────────────────────────
exports.addOffer = async (req, res) => {
  try {
   const {
    name,
    type,
    target,
    discountType,
    discountValue,
    maxDiscountAmount,
    startDate,
    endDate
} = req.body;

    // Server-side validation (frontend already validates but never trust only that)
    if (!name || !type || !target || !discountValue || !startDate || !endDate) {
      req.flash('error', 'All fields are required');
      return res.redirect('/admin/offers');
    }

    

    if (
    discountType === "percent" &&
    parseFloat(discountValue) > 80
) {
    req.flash("error", "Percentage discount cannot exceed 80%.");
    return res.redirect("/admin/offers");
}

if (
    discountType === "percent" &&
    maxDiscountAmount &&
    Number(maxDiscountAmount) <= 0
) {
    req.flash("error", "Maximum discount amount must be greater than 0.");
    return res.redirect("/admin/offers");
}

    if (new Date(endDate) <= new Date(startDate)) {
      req.flash('error', 'End date must be after start date');
      return res.redirect('/admin/offers');
    }

    if (parseFloat(discountValue) <= 0) {
      req.flash('error', 'Discount value must be greater than 0');
      return res.redirect('/admin/offers');
    }

    await Offer.create({
      name: name.trim(),
      type,
      target,
      discountType,
      discountValue: parseFloat(discountValue),
      maxDiscountAmount:
        discountType === "percent"
            ? Number(maxDiscountAmount) || null
            : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    });

    req.flash('success', 'Offer created successfully');
    res.redirect('/admin/offers');
  } catch (err) {
    console.error('Add offer error:', err);
    req.flash('error', 'Failed to create offer');
    res.redirect('/admin/offers');
  }
};

// ─── Edit Offer ───────────────────────────────────────────────────────────────
exports.editOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, discountType, discountValue,  maxDiscountAmount,startDate, endDate } = req.body;
    // Note: type and target are NOT editable after creation (read-only in edit modal)

    if (!name || !discountValue || !startDate || !endDate) {
      req.flash('error', 'All fields are required');
      return res.redirect('/admin/offers');
    }

    if (new Date(endDate) <= new Date(startDate)) {
      req.flash('error', 'End date must be after start date');
      return res.redirect('/admin/offers');
    }

    if (parseFloat(discountValue) <= 0) {
      req.flash('error', 'Discount value must be greater than 0');
      return res.redirect('/admin/offers');
    }
    if (
    discountType === "percent" &&
    parseFloat(discountValue) > 80
) {
    req.flash("error", "Percentage discount cannot exceed 80%.");
    return res.redirect("/admin/offers");
}

if (
    discountType === "percent" &&
    maxDiscountAmount &&
    Number(maxDiscountAmount) <= 0
) {
    req.flash("error", "Maximum discount amount must be greater than 0.");
    return res.redirect("/admin/offers");
}


    await Offer.findByIdAndUpdate(id, {
      name: name.trim(),
      discountType,
      discountValue: parseFloat(discountValue),
      maxDiscountAmount:
    discountType === "percent"
        ? Number(maxDiscountAmount) || null
        : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    


    req.flash('success', 'Offer updated successfully');
    res.redirect('/admin/offers');
  } catch (err) {
    console.error('Edit offer error:', err);
    req.flash('error', 'Failed to update offer');
    res.redirect('/admin/offers');
  }
};

// ─── Toggle Active/Inactive ───────────────────────────────────────────────────
exports.toggleOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      req.flash('error', 'Offer not found');
      return res.redirect('/admin/offers');
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    req.flash('success', `Offer ${offer.isActive ? 'activated' : 'deactivated'}`);
    res.redirect('/admin/offers');
  } catch (err) {
    console.error('Toggle offer error:', err);
    req.flash('error', 'Failed to toggle offer');
    res.redirect('/admin/offers');
  }
};

// ─── Delete Offer ─────────────────────────────────────────────────────────────
// Soft-delete: set isActive false + mark deleted.
// Never hard-delete — past orders may reference price data computed from this offer.
exports.deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndUpdate(req.params.id, {
      isActive: false,
      isDeleted: true,
    });

    req.flash('success', 'Offer deleted');
    res.redirect('/admin/offers');
  } catch (err) {
    console.error('Delete offer error:', err);
    req.flash('error', 'Failed to delete offer');
    res.redirect('/admin/offers');
  }
};