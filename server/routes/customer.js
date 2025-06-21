const router = require('express').Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const CustomerProfile = require('../models/CustomerProfile');
const BankDetails = require('../models/BankDetails');
const Transaction = require('../models/Transaction');
const AdminCommission = require('../models/AdminCommission');
const { redeemVoucher } = require('../services/voucherService');
const { processWithdrawal } = require('../services/bankService');

// @route   GET /api/customer/profile
// @desc    Get customer profile
router.get('/profile', auth(['customer']), async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({ userId: req.user.id })
      .populate('transactions')
      .populate('bankDetails');
    
    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' });
    }

    res.json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/customer/bank-details
// @desc    Add or update bank details
router.post('/bank-details', auth(['customer']), [
  check('bankName', 'Bank name is required').not().isEmpty(),
  check('accountNumber', 'Account number is required').not().isEmpty(),
  check('accountType', 'Account type is required').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { bankName, accountNumber, accountType, branchCode } = req.body;

  try {
    let bankDetails = await BankDetails.findOne({ userId: req.user.id });

    if (bankDetails) {
      // Update existing
      bankDetails.bankName = bankName;
      bankDetails.accountNumber = accountNumber;
      bankDetails.accountType = accountType;
      bankDetails.branchCode = branchCode;
    } else {
      // Create new
      bankDetails = new BankDetails({
        userId: req.user.id,
        bankName,
        accountNumber,
        accountType,
        branchCode
      });
    }

    await bankDetails.save();

    // Update customer profile with bank details reference
    await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { bankDetails: bankDetails._id } },
      { new: true }
    );

    res.json(bankDetails);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/customer/redeem
// @desc    Redeem a voucher
router.post('/redeem', auth(['customer']), [
  check('voucherCode', 'Voucher code is required').not().isEmpty(),
  check('voucherType', 'Voucher type is required').isIn(['shoprite', 'capitec', 'standardbank'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { voucherCode, voucherType } = req.body;

  try {
    // Redeem voucher with external service
    const redemptionResult = await redeemVoucher(voucherCode, voucherType);
    
    if (!redemptionResult.success) {
      return res.status(400).json({ msg: redemptionResult.message });
    }

    const voucherAmount = redemptionResult.amount;
    const commission = voucherAmount * 0.03; // 3% commission
    const userAmount = voucherAmount - commission;

    // Update customer balance
    const profile = await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { balance: userAmount } },
      { new: true }
    );

    // Add voucher to profile
    await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $push: { 
        vouchers: {
          code: voucherCode,
          amount: voucherAmount,
          type: voucherType,
          redeemedAt: new Date(),
          status: 'redeemed'
        }
      }},
      { new: true }
    );

    // Create transaction record
    const transaction = new Transaction({
      userId: req.user.id,
      type: 'redeem',
      amount: userAmount,
      fee: commission,
      status: 'completed',
      details: {
        voucherCode,
        voucherType,
        originalAmount: voucherAmount
      }
    });
    await transaction.save();

    // Update customer profile with transaction reference
    await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $push: { transactions: transaction._id } }
    );

    // Update admin commission
    await AdminCommission.findOneAndUpdate(
      {},
      { $inc: { totalCommission: commission } },
      { upsert: true, new: true }
    );

    res.json({
      msg: 'Voucher redeemed successfully',
      amount: userAmount,
      commission,
      newBalance: profile.balance
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/customer/withdraw
// @desc    Withdraw funds to bank account
router.post('/withdraw', auth(['customer']), [
  check('amount', 'Amount is required and must be positive').isFloat({ gt: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount } = req.body;

  try {
    // Check customer balance
    const profile = await CustomerProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' });
    }

    if (profile.balance < amount) {
      return res.status(400).json({ msg: 'Insufficient funds' });
    }

    // Check bank details
    const bankDetails = await BankDetails.findOne({ userId: req.user.id });
    if (!bankDetails) {
      return res.status(400).json({ msg: 'Bank details not found' });
    }

    // Process withdrawal
    const withdrawalResult = await processWithdrawal(
      bankDetails.accountNumber,
      bankDetails.bankName,
      amount
    );

    if (!withdrawalResult.success) {
      return res.status(400).json({ msg: withdrawalResult.message });
    }

    // Update customer balance
    await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { balance: -amount } }
    );

    // Create transaction record
    const transaction = new Transaction({
      userId: req.user.id,
      type: 'withdrawal',
      amount: amount,
      fee: 0,
      status: 'completed',
      details: {
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber
      }
    });
    await transaction.save();

    // Update customer profile with transaction reference
    await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $push: { transactions: transaction._id } }
    );

    res.json({
      msg: 'Withdrawal processed successfully',
      amount,
      newBalance: profile.balance - amount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/customer/transfer
// @desc    Transfer funds to another user
router.post('/transfer', auth(['customer']), [
  check('recipientEmail', 'Recipient email is required').isEmail(),
  check('amount', 'Amount is required and must be positive').isFloat({ gt: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { recipientEmail, amount } = req.body;

  try {
    // Check sender balance
    const senderProfile = await CustomerProfile.findOne({ userId: req.user.id });
    if (!senderProfile) {
      return res.status(404).json({ msg: 'Your profile not found' });
    }

    if (senderProfile.balance < amount) {
      return res.status(400).json({ msg: 'Insufficient funds' });
    }

    // Find recipient
    const recipient = await User.findOne({ email: recipientEmail, userType: 'customer' });
    if (!recipient) {
      return res.status(404).json({ msg: 'Recipient not found' });
    }

    if (recipient._id.toString() === req.user.id) {
      return res.status(400).json({ msg: 'Cannot transfer to yourself' });
    }

    const recipientProfile = await CustomerProfile.findOne({ userId: recipient._id });
    if (!recipientProfile) {
      return res.status(404).json({ msg: 'Recipient profile not found' });
    }

    // Calculate commission (3%)
    const commission = amount * 0.03;
    const transferAmount = amount - commission;

    // Update balances
    await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { balance: -amount } }
    );

    await CustomerProfile.findOneAndUpdate(
      { userId: recipient._id },
      { $inc: { balance: transferAmount } }
    );

    // Create transaction records
    const senderTransaction = new Transaction({
      userId: req.user.id,
      type: 'transfer',
      amount: -amount,
      fee: commission,
      status: 'completed',
      details: {
        recipient: recipient.email,
        transferAmount
      },
      recipientId: recipient._id
    });
    await senderTransaction.save();

    const recipientTransaction = new Transaction({
      userId: recipient._id,
      type: 'transfer',
      amount: transferAmount,
      fee: 0,
      status: 'completed',
      details: {
        sender: req.user.email,
        originalAmount: amount
      },
      recipientId: req.user.id
    });
    await recipientTransaction.save();

    // Update customer profiles with transaction references
    await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $push: { transactions: senderTransaction._id } }
    );

    await CustomerProfile.findOneAndUpdate(
      { userId: recipient._id },
      { $push: { transactions: recipientTransaction._id } }
    );

    // Update admin commission
    await AdminCommission.findOneAndUpdate(
      {},
      { $inc: { totalCommission: commission } },
      { upsert: true, new: true }
    );

    res.json({
      msg: 'Transfer completed successfully',
      amount,
      commission,
      transferAmount,
      newBalance: senderProfile.balance - amount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
