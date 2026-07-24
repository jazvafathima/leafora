function generateReferralCode(name) {
  const prefix = (name || "USR").substring(0, 3).toUpperCase();

  const random = Math.random().toString(36).substring(2, 8).toUpperCase();

  return prefix + random;
}

module.exports = { generateReferralCode };
