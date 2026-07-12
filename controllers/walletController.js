const Wallet = require('../models/wallet');
const crypto = require('crypto');
const razorpay = require("../utils/razorpay");
const walletService = require("../services/walletService");
// ─── Get or Create Wallet ───────────────────────────────────────────────────

exports.getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });

  if (!wallet) {
    wallet = await Wallet.create({
      user: userId,
      balance: 0,
      transactions: [],
    });
  }

  return wallet;
};

// ─── Credit Wallet ──────────────────────────────────────────────────────────

exports.creditWallet = async (userId, amount, reason, orderId = null) => {
  if (!amount || amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  const txnId = 'TXN-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  const wallet = await walletService.getOrCreateWallet(userId);

  wallet.balance = Math.round((wallet.balance + amount) * 100) / 100;

  wallet.transactions.unshift({
    type: 'credit',
    amount,
    reason,
    orderId,
    transactionId: txnId,
    createdAt: new Date(),
  });

  await wallet.save();

  return wallet;
};

// ─── Debit Wallet ───────────────────────────────────────────────────────────

exports.debitWallet = async (userId, amount, reason, orderId = null) => {
  if (!amount || amount <= 0) {
    throw new Error('Debit amount must be positive');
  }

  const wallet = await walletService.getOrCreateWallet(userId);

  if (wallet.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }

  const txnId = 'TXN-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  wallet.balance = Math.round((wallet.balance - amount) * 100) / 100;

  wallet.transactions.unshift({
    type: 'debit',
    amount,
    reason,
    orderId,
    transactionId: txnId,
    createdAt: new Date(),
  });

  await wallet.save();

  return wallet;
};

// ─── Wallet Page ────────────────────────────────────────────────────────────

exports.getWalletPage = async (req, res) => {
  try {
    const wallet = await walletService.getOrCreateWallet(req.user._id);

    const totalCredits = wallet.transactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = wallet.transactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    res.render('user/wallet', {
      user: req.user,
      wallet,
      transactions: wallet.transactions,
      totalCredits,
      totalDebits,
    });
  } catch (err) {
    console.error('Wallet page error:', err);
    res.redirect('/');
  }
};

// ─── Create Razorpay Order ──────────────────────────────────────────────────

exports.createRazorpayOrder = async (req, res) => {
  try {
    const amount = 50000; // ₹500 in paise

    const options = {
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrder
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to create Razorpay order"
    });
  }
};

// ─── Verify Razorpay Payment ────────────────────────────────────────────────

exports.verifyAddFundsPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
    } = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }

    await walletService.creditWallet(
      req.user._id,
      Number(amount),
      'Added via Razorpay',
      null
    );

    res.json({
      success: true,
      message: 'Funds added successfully',
    });
  } catch (err) {
    console.error('Verify add-funds error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error during verification',
    });
  }
};