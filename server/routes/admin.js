const router = require('express').Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const AdminCommission = require('../models/AdminCommission');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { processWithdrawal } = require('../services/bankService');

// @route   GET /api/admin/commission
// @desc    Get commission summary
router.get('/commission', auth(['admin']), async (req, res) => {
  try {
    const commission = await AdminCommission.findOne({});
    if (!commission) {
      return res.json({
        totalCommission: 0,
        withdrawnCommission: 0,
        availableCommission: 0
      });
    }

    const availableCommission = commission.totalCommission - commission.withdrawnCommission;

    res.json({
      totalCommission: commission.totalCommission,
      withdrawnCommission: commission.withdrawnCommission,
      availableCommission
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admin/transactions
// @desc    Get all transactions
router.get('/transactions', auth(['admin']), async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'email firstName lastName')
      .populate('recipientId', 'email firstName lastName');
    
    res.json(transactions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/admin/withdraw-commission
// @desc    Withdraw commission to bank account
router.post('/withdraw-commission', auth(['admin']), [
  check('amount', 'Amount is required and must be positive').isFloat({ gt: 0 }),
  check('bankName', 'Bank name is required').not().isEmpty(),
  check('accountNumber', 'Account number is required').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount, bankName, accountNumber } = req.body;

  try {
    const commission = await AdminCommission.findOne({});
    if (!commission) {
      return res.status(400).json({ msg: 'No commission available' });
    }

    const availableCommission = commission.totalCommission - commission.withdrawnCommission;
    if (amount > availableCommission) {
      return res.status(400).json({ msg: 'Insufficient commission funds' });
    }

    // Process bank withdrawal
    const withdrawalResult = await processWithdrawal(
      accountNumber,
      bankName,
      amount
    );

    if (!withdrawalResult.success) {
      return res.status(400).json({ msg: withdrawalResult.message });
    }

    // Update commission records
    await AdminCommission.findOneAndUpdate(
      {},
      { 
        $inc: { withdrawnCommission: amount },
        $push: { 
          withdrawalHistory: {
            amount,
            bankDetails: { bankName, accountNumber },
            processedAt: new Date()
          }
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      msg: 'Commission withdrawal processed successfully',
      amount,
      remainingCommission: availableCommission - amount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admin/users
// @desc    Get all users
router.get('/users', auth(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admin/user/:id
// @desc    Get user details
router.get('/user/:id', auth(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    let profile;
    if (user.userType === 'customer') {
      profile = await CustomerProfile.findOne({ userId: user._id })
        .populate('bankDetails')
        .populate('transactions');
    }

    res.json({ user, profile });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
