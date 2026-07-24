exports.rewardReferral = async (newUser) => {
  if (!newUser.referredBy) return;

  if (newUser.referralRewardGiven) return;

  await walletService.creditWallet(newUser._id, 50, "Referral Signup Bonus");

  await walletService.creditWallet(newUser.referredBy, 100, "Referral Reward");

  newUser.referralRewardGiven = true;

  await newUser.save();
};
