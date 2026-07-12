const Coupon = require('../models/Coupon');

/* ═══════════════════════════════════════════
   REUSABLE VALIDATION FUNCTION
   Call this from checkout controller too
═══════════════════════════════════════════ */
async function validateCoupon(code, userId, cartSubtotal) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });

  // 1. Exists and active
  if (!coupon || !coupon.isActive) {
    return { valid: false, message: 'Invalid or inactive coupon code' };
  }

  // 2. Not expired
  if (new Date(coupon.expiryDate) < new Date()) {
    return { valid: false, message: 'This coupon has expired' };
  }

  // 3. Minimum purchase
  if (cartSubtotal < coupon.minPurchase) {
    const needed = coupon.minPurchase - cartSubtotal;
    return {
      valid: false,
      message: `Add ₹${needed.toLocaleString('en-IN')} more to use this coupon`
    };
  }

  // 4. Global usage limit
  const totalUsed = coupon.usedBy ? coupon.usedBy.length : 0;
  if (totalUsed >= coupon.usageLimit) {
    return { valid: false, message: 'This coupon has reached its usage limit' };
  }

  // 5. Per-user limit
  const userUsageCount = coupon.usedBy
    ? coupon.usedBy.filter(u => u.user.toString() === userId.toString()).length
    : 0;
  if (userUsageCount >= coupon.perUserLimit) {
    return { valid: false, message: 'You have already used this coupon' };
  }

  // ✓ Valid — compute discount amount
  let discountAmount = 0;
  if (coupon.discountType === 'flat') {
    discountAmount = coupon.discountValue;
  } else {
    discountAmount = Math.round((cartSubtotal * coupon.discountValue) / 100);
    // Apply cap if maxDiscount is set
    if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }
  }

  // Discount can't exceed cart total
  discountAmount = Math.min(discountAmount, cartSubtotal);

  return { valid: true, coupon, discountAmount };
}

/* ═══════════════════════════════════════════
   PAGE CONTROLLER
═══════════════════════════════════════════ */
const getCouponsPage = async (req, res) => {
  try {
    const { search = '', type = '', status = '', page = 1 } = req.query;
    const limit = 10;
    const skip  = (page - 1) * limit;

    const query = {};
    if (search) query.code = { $regex: search.toUpperCase(), $options: 'i' };
    if (type)   query.discountType = type;

    const now = new Date();
    if (status === 'active')   { query.isActive = true;  query.expiryDate = { $gte: now }; }
    if (status === 'inactive') { query.isActive = false; }
    if (status === 'expired')  { query.expiryDate = { $lt: now }; }

    const [coupons, totalCoupons] = await Promise.all([
      Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(query),
    ]);

    res.render('admin/coupons', {
      coupons,
      totalCoupons,
      totalPages:   Math.ceil(totalCoupons / limit),
      currentPage:  Number(page),
      search,
      typeFilter:   type,
      statusFilter: status,
      admin:        req.session.admin,
      success:      req.flash('success'),
      error:        req.flash('error'),
    });
  } catch (err) {
    console.error('Coupons page error:', err);
    req.flash('error', 'Failed to load coupons');
    res.redirect('/admin/dashboard');
  }
};

/* ═══════════════════════════════════════════
   ADD COUPON
═══════════════════════════════════════════ */
const addCoupon = async (req, res) => {
  try {
    const {
      code, discountType, discountValue,
      minPurchase, maxDiscount, usageLimit, perUserLimit, expiryDate
    } = req.body;

    // Backend validation — never rely on frontend only
    if (!code || !discountType || !discountValue || !usageLimit || !expiryDate) {
      req.flash('error', 'All required fields must be filled');
      return res.redirect('/admin/coupons');
    }
    if (new Date(expiryDate) <= new Date()) {
      req.flash('error', 'Expiry date must be in the future');
      return res.redirect('/admin/coupons');
    }
    if (parseFloat(discountValue) <= 0) {
      req.flash('error', 'Discount value must be greater than 0');
      return res.redirect('/admin/coupons');
    }
    if (discountType === 'percentage' && parseFloat(discountValue) > 100) {
      req.flash('error', 'Percentage discount cannot exceed 100%');
      return res.redirect('/admin/coupons');
    }

    // Check duplicate code
    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      req.flash('error', `Coupon code "${code.toUpperCase()}" already exists`);
      return res.redirect('/admin/coupons');
    }

    await Coupon.create({
      code:          code.toUpperCase().trim(),
      discountType,
      discountValue: parseFloat(discountValue),
      minPurchase:   parseFloat(minPurchase)   || 0,
      maxDiscount:   parseFloat(maxDiscount)   || null,
      usageLimit:    parseInt(usageLimit),
      perUserLimit:  parseInt(perUserLimit)    || 1,
      expiryDate:    new Date(expiryDate),
      isActive:      true,
    });

    req.flash('success', 'Coupon created successfully');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Add coupon error:', err);
    req.flash('error', err.code === 11000 ? 'Coupon code already exists' : 'Failed to create coupon');
    res.redirect('/admin/coupons');
  }
};

/* ═══════════════════════════════════════════
   EDIT COUPON
═══════════════════════════════════════════ */
const editCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      discountType, discountValue,
      minPurchase, maxDiscount, usageLimit, perUserLimit, expiryDate
    } = req.body;

    if (!discountValue || !usageLimit || !expiryDate) {
      req.flash('error', 'All required fields must be filled');
      return res.redirect('/admin/coupons');
    }
    if (parseFloat(discountValue) <= 0) {
      req.flash('error', 'Discount value must be greater than 0');
      return res.redirect('/admin/coupons');
    }

    await Coupon.findByIdAndUpdate(id, {
      discountType,
      discountValue: parseFloat(discountValue),
      minPurchase:   parseFloat(minPurchase)   || 0,
      maxDiscount:   parseFloat(maxDiscount)   || null,
      usageLimit:    parseInt(usageLimit),
      perUserLimit:  parseInt(perUserLimit)    || 1,
      expiryDate:    new Date(expiryDate),
    });

    req.flash('success', 'Coupon updated successfully');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Edit coupon error:', err);
    req.flash('error', 'Failed to update coupon');
    res.redirect('/admin/coupons');
  }
};

/* ═══════════════════════════════════════════
   TOGGLE ACTIVE / INACTIVE
═══════════════════════════════════════════ */
const toggleCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      req.flash('error', 'Coupon not found');
      return res.redirect('/admin/coupons');
    }
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    req.flash('success', `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`);
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Toggle coupon error:', err);
    req.flash('error', 'Failed to toggle coupon');
    res.redirect('/admin/coupons');
  }
};

/* ═══════════════════════════════════════════
   SOFT DELETE
═══════════════════════════════════════════ */
const deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndUpdate(req.params.id, {
      isActive:  false,
      isDeleted: true,
    });
    req.flash('success', 'Coupon deleted');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Delete coupon error:', err);
    req.flash('error', 'Failed to delete coupon');
    res.redirect('/admin/coupons');
  }
};

module.exports = {
  getCouponsPage,
  addCoupon,
  editCoupon,
  toggleCoupon,
  deleteCoupon,
  validateCoupon,   // ← import this in your checkout controller
};