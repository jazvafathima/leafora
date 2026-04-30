require('dotenv').config();
console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);

const express    = require('express');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const flash      = require('connect-flash');
const morgan     = require('morgan');
const path       = require('path');
const passport = require('passport');

require('./config/passport');

const connectDB   = require('./config/db');
const userRoutes  = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');



// ─── Connect to MongoDB ─────────────────────────
connectDB();

const app = express();


// ─── View Engine ────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// ─── Middleware ─────────────────────────────────
// ─── Middleware ─────────────────────────────────
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// ─── Session (MUST COME BEFORE PASSPORT) ────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'leafora_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  }
}));


// ─── Passport (AFTER session) ───────────────────
app.use(passport.initialize());
app.use(passport.session());


// ─── Flash Messages ─────────────────────────────
app.use(flash());


// ─── Global Template Variables ──────────────────
app.use((req, res, next) => {
  res.locals.success  = req.flash('success');
  res.locals.error    = req.flash('error');
  res.locals.user     = req.session.user || null;
  next();
});


// ─── ROUTES (ONLY ONCE) ─────────────────────────
app.use('/user', userRoutes);
app.use('/admin',adminRoutes);

// 🧪 Test Route (optional)
app.get('/test', (req, res) => {
  res.send("TEST WORKING");
});


// ─── 404 Handler (MUST BE AFTER ROUTES) ─────────
app.use((req, res) => {
  res.status(404).send("Page Not Found");
});


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