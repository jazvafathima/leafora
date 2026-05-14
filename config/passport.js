const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/user/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;

    // 👉 Step 1: check if user already exists by email
    let user = await User.findOne({ email });

    if (user) {
      // 👉 If user exists but no googleId, link it
      if (!user.googleId) {
        user.googleId = profile.id;
        await user.save();
      }
    } else {
      // 👉 If user does not exist, create new
      user = await User.create({
        firstName: profile.name.givenName,
        lastName: profile.name.familyName || '',
        email,
        googleId: profile.id,
        isVerified: true
      });
    }

    return done(null, user);

  } catch (err) {
    return done(err, null);
  }
}
));

// session handling
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;