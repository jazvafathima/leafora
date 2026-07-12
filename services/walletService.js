const Wallet = require("../models/wallet");
const crypto = require("crypto");

// Get or Create Wallet
exports.getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });

  if (!wallet) {
    wallet = await Wallet.create({
      user: userId,
      balance: 0,
      transactions: []
    });
  }

  return wallet;
};

// Credit Wallet
exports.creditWallet = async (
  userId,
  amount,
  reason,
  orderId = null
) => {

  if (!amount || amount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  const wallet = await exports.getOrCreateWallet(userId);

  wallet.balance += amount;

  wallet.transactions.unshift({
    type: "credit",
    amount,
    reason,
    orderId,
    transactionId:
      "TXN-" +
      crypto.randomBytes(4).toString("hex").toUpperCase(),
    createdAt: new Date()
  });

  await wallet.save();

  return wallet;
};

// Debit Wallet
exports.debitWallet = async (
  userId,
  amount,
  reason,
  orderId = null
) => {

  if (!amount || amount <= 0) {
    throw new Error("Debit amount must be positive");
  }

  const wallet = await exports.getOrCreateWallet(userId);

  if (wallet.balance < amount) {
    throw new Error("Insufficient wallet balance");
  }

  wallet.balance -= amount;

  wallet.transactions.unshift({
    type: "debit",
    amount,
    reason,
    orderId,
    transactionId:
      "TXN-" +
      crypto.randomBytes(4).toString("hex").toUpperCase(),
    createdAt: new Date()
  });

  await wallet.save();

  return wallet;
};