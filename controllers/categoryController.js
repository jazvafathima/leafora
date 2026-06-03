const Category = require('../models/Category');
const fs = require('fs');
const path = require('path');


// =============================
// CATEGORY LIST
// =============================

exports.getCategories = async (req, res) => {

  try {

    let {
      search = '',
      page = 1,
      limit = 10
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

  const filter = {
  $or: [
    { isDeleted: false },
    { isDeleted: { $exists: false } }
  ]
};

    if (search) {
  filter.name = { $regex: search, $options: 'i' };
}


    const totalCount = await Category.countDocuments(filter);

    const totalPages = Math.ceil(totalCount / limit);


    const categories = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);


    res.render('admin/category/category', {
      categories,
      currentPage: page,
      totalPages,
      totalCount,
      search

    });

    

  } catch (error) {

    console.log(error);

    res.status(500).send('Server Error');
  }
};




// =============================
// ADD PAGE
// =============================

exports.getAddCategory = (req, res) => {

  res.render('admin/category/addCategory');
};




// =============================
// ADD CATEGORY
// =============================

exports.addCategory = async (req, res) => {

  try {

    let { name } = req.body;

    name = name.trim();

    // validation
    if (!name || name.length < 2) {

      return res.status(400).json({
        success: false,
        message: 'Category name must be at least 2 characters'
      });
    }


    // duplicate check
    const existing = await Category.findOne({
      name: new RegExp(`^${name}$`, 'i'),
      isDeleted: false
    });


    if (existing) {

      return res.status(409).json({
        success: false,
        message: 'Category already exists'
      });
    }


    // image
    let image = '';

    if (req.file) {
      image = req.file.filename;
    }


    const category = await Category.create({
      name,
      image,
       isActive: true,
     isDeleted: false
    
    });


   return res.redirect('/admin/categories');

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};




// =============================
// EDIT PAGE
// =============================

exports.getEditCategory = async (req, res) => {

  try {

    const category = await Category.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!category) {

      return res.status(404).send('Category not found');
    }

    res.render('admin/category/editCategory', {
      category
    });

  } catch (error) {

    console.log(error);

    res.status(500).send('Server Error');
  }
};




// =============================
// UPDATE CATEGORY


exports.updateCategory = async (req, res) => {
  try {



    const category = await Category.findById(req.params.id);
    
    console.log("PARAM ID:", req.params.id);

    if (!category || category.isDeleted === true) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const updates = {};

    // NAME UPDATE
    if (req.body.name) {
      const name = req.body.name.trim();

      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Name must be at least 2 characters'
        });
      }

      const existing = await Category.findOne({
        _id: { $ne: category._id },
        name: new RegExp(`^${name}$`, 'i'),
        isDeleted: false
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Category name already exists'
        });
      }

      updates.name = name;
    }

   

    await Category.findByIdAndUpdate(req.params.id, updates, {
      new: true
    });

    return res.redirect('/admin/categories');

  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};


 


//block and unblock=================

exports.blockCategory=async (req,res)=>{
    try{

        await Category.findByIdAndUpdate(
            req.params.id,
            {isActive:false}
        );
        res.redirect('/admin/categories');
    }catch(error){
        console.log(error)
        res.redirect('/admin/category/categories');
    }
};

exports.unblockCategory= async (req,res)=>{
    try{

        await Category.findByIdAndUpdate(
            req.params.id,
            {isActive:true}
        );
        res.redirect('/admin/categories')
    }catch(error){
        console.log(error);
    res.redirect('/admin/categories');
    }
}

