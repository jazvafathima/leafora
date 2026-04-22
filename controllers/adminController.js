const Admin = require('../models/Admin');
const bcrypt = require('bcrypt');
const User = require('../models/User');

exports.loadLogin = (req, res) => {
    res.render('admin/login');
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.json({
                success: false,
                message: "Invalid email"
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.json({
                success: false,
                message: "Wrong password"
            });
        }

        res.json({ success: true });

    } catch (err) {
        console.log(err); // helpful for debugging
        res.json({
            success: false,
            message: "Server error"
        });
    }
};


// Block User
exports.blockUser = async (req, res) => {
    try {
        const userId = req.params.id;

        await User.findByIdAndUpdate(userId, { isBlocked: true });

        res.json({ success: true, message: "User blocked" });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// Unblock User
exports.unblockUser = async (req, res) => {
    try {
        const userId = req.params.id;

        await User.findByIdAndUpdate(userId, { isBlocked: false });

        res.json({ success: true, message: "User unblocked" });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};