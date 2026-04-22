const User = require('../models/User');
const bcrypt = require('bcrypt');

// ── GET SIGNUP ─────────────────────────────
exports.getSignup = (req, res) => {
    res.render('user/signup');
};

// ── POST SIGNUP ────────────────────────────
exports.postSignup = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

const name = firstName + " " + lastName;

        // check existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.send("User already exists");
        }

        // hash password
        // const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            firstName,
            lastName,
            email,
            password
        });

        await newUser.save();

        // create session
        req.session.user = newUser._id;

        // redirect
        res.redirect('/dashboard');

    } catch (err) {
        console.log(err);
        res.send("Signup error");
    }
    console.log("Session:", req.session);
};
exports.getSignup = (req, res) => {
    const errors = req.flash('errors');
    const formData = req.flash('formData');

    res.render('user/signup', {
        errors: errors.length ? JSON.parse(errors[0]) : {},
        formData: formData.length ? JSON.parse(formData[0]) : {}
    });
};

// ── GET LOGIN ─────────────────────────────
exports.getLogin = (req, res) => {
    res.render('user/login');
};

// ── POST LOGIN ────────────────────────────
exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.send("User not found");
        }

        // compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.send("Invalid password");
        }

        // session
        req.session.user = user._id;

        res.redirect('/dashboard');

    } catch (err) {
        console.log(err);
        res.send("Login error");
    }
};

// ── LOGOUT ────────────────────────────────
exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};

// ── DASHBOARD ─────────────────────────────
exports.getDashboard = (req, res) => {
    res.render('user/home');
};


