







require('dotenv').config();
 
const express    = require('express');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const flash      = require('connect-flash');
const morgan     = require('morgan');
const path       = require('path');
 
const connectDB   = require('./config/db');
const userRoutes = require('./routes/userRoutes');

// ─── Connect to MongoDB ────────────────────────────────────────────────────
connectDB();
 
const app = express();
 
// ─── View Engine ──────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
 
// ─── Middleware ────────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


 
// ─── Session ──────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'leafora_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 60 * 60 * 24 * (parseInt(process.env.SESSION_EXPIRE_DAYS) || 7),
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * (parseInt(process.env.SESSION_EXPIRE_DAYS) || 7),
  },
}));
 

// ─── Flash Messages ────────────────────────────────────────────────────────
app.use(flash());
 
// ─── Global Template Locals ───────────────────────────────────────────────
// Makes flash messages & current user available in every EJS template
app.use((req, res, next) => {
  res.locals.success  = req.flash('success');
  res.locals.error    = req.flash('error');
  res.locals.errors   = req.flash('errors');   // field-level validation errors
  res.locals.formData = req.flash('formData'); // repopulate form on error
  res.locals.user     = req.session.user || null;
  next();
});
 
// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/user', userRoutes);
 
// ─── 404 Handler ──────────────────────────────────────────────────────────
// app.use((req, res) => {
//   res.status(404).render('404', { title: 'Page Not Found' });
// });

 
// ─── Global Error Handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("🔥 REAL ERROR:", err); // prints full error
  res.status(500).send(err.message);   // shows error in browser
});
// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌿 Leafora running on http://localhost:${PORT}`);
});
































