const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const CustomerProfile = require('../models/CustomerProfile');

router.post('/register', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Please enter a password with 6+ characters').isLength({ min: 6 }),
  check('phone', 'Phone number is required').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password, firstName, lastName, phone, userType = 'customer' } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({
      email,
      password: await bcrypt.hash(password, 12),
      firstName,
      lastName,
      phone,
      userType
    });

    await user.save();

    if (userType === 'customer') {
      const profile = new CustomerProfile({ userId: user._id });
      await profile.save();
    }

    const payload = { id: user._id, userType: user.userType };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ token, userType: user.userType });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

router.post('/login', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const payload = { id: user._id, userType: user.userType };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, userType: user.userType });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
