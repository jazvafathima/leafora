const { body, validationResult } = require("express-validator");

// ─── Signup Validation Rules ──────────────────────────────────────────────
const signupRules = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required.")
    .isLength({ max: 50 })
    .withMessage("First name must be under 50 characters.")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("First name can only contain letters."),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required.")
    .isLength({ max: 50 })
    .withMessage("Last name must be under 50 characters.")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Last name can only contain letters."),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email address is required.")
    .isEmail()
    .withMessage("Please enter a valid email address.")
    .normalizeEmail(),

  body("phone")
    .optional({ checkFalsy: true })
    .isMobilePhone("en-IN")
    .withMessage("Please enter a valid Indian phone number."),

  body("password")
    .notEmpty()
    .withMessage("Password is required.")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters.")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter.")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter.")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number.")
    .matches(/[@$!%*?&#^]/)
    .withMessage(
      "Password must contain at least one special character (@$!%*?&#^).",
    ),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your password.")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match.");
      }
      return true;
    }),
];

// ─── Login Validation Rules ───────────────────────────────────────────────
const loginRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email address is required.")
    .isEmail()
    .withMessage("Please enter a valid email address.")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required."),
];

// ─── Middleware: collect errors, flash them, redirect back ────────────────
const handleValidation = (redirectPath) => (req, res, next) => {
  const result = validationResult(req);

  // 🔥 DEBUG HERE
  console.log("Validation errors:", result.array());

  if (result.isEmpty()) return next();

  const errors = {};
  result.array().forEach((err) => {
    if (!errors[err.path]) errors[err.path] = err.msg;
  });

  req.flash("errors", JSON.stringify(errors));
  req.flash("formData", JSON.stringify(req.body));

  return res.redirect(redirectPath);
};

module.exports = { signupRules, loginRules, handleValidation };
