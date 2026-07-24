require("dotenv").config();
console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const morgan = require("morgan");
const path = require("path");
const passport = require("passport");
const nocache = require("nocache");
require("./config/passport");

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const checkUserBlocked = require("./middleware/checkUserBlocked");
const methodOverride = require("method-override");
const navbarCounts = require("./middleware/navbarCounts");
const authController = require("./controllers/userController");

const { error } = require("console");

// ─── Connect to MongoDB ─────────────────────────
connectDB();

const app = express();

// ─── View Engine ────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ─── Middleware ─────────────────────────────────
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("public/uploads"));
app.use(express.static("public"));
app.use(methodOverride("_method"));

// ─── Session (MUST COME BEFORE PASSPORT) ────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || "leafora_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  }),
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});

app.use(nocache());
app.use(checkUserBlocked);
app.use(passport.initialize());
app.use(passport.session());

// ─── Global Template Variables ──────────────────
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.userId || null;
  next();
});

const navbarData = require("./middleware/navbarData");
app.use(navbarData); // now every render() has cartCount & wishlistCount available

// ─── ROUTES (ONLY ONCE) ─────────────────────────
app.use("/", userRoutes);
app.use("/admin", adminRoutes);
console.log("ADMIN ROUTES CONNECTED");

// 404 - catches any request that didn't match a route above
app.use(authController.getNotFound);

// 500 - catches errors passed via next(err) anywhere in the app
app.use(authController.getServerError);

// ─── Global Error Handler ───────────────────────
app.use((err, req, res, next) => {
  console.error("🔥 REAL ERROR:", err);
  res.status(500).send(err.message);
});

// ─── Start Server ───────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌿 Leafora running on http://localhost:${PORT}`);
});
