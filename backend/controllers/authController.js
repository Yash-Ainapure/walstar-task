const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ? parseInt(process.env.JWT_EXPIRES_IN, 10) : 3600; // seconds

// Register (public) - create a superadmin or driver
exports.register = async (req, res) => {
  try {
    const { username, password, name, phone, address, photoUrl, role } = req.body;
    if (!username || !password) return res.status(400).json({ msg: 'username and password required' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ msg: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, saltRounds);
    const user = new User({ username, passwordHash, name, phone, address, photoUrl, role });
    await user.save();

    const token = jwt.sign({ userId: user._id.toString(), role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
    res.json({ token });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Login (public)
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ msg: 'username and password required' });
    console.log('--- LOGIN ---');
    console.log('Logging in with:', { username, password });

    const user = await User.findOne({ username });
    if (!user || !user.passwordHash) return res.status(400).json({ msg: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ msg: 'Invalid credentials' });
    console.log('User found:', user);

    // if (user.role != 'superadmin' && user.role == 'driver') {
    //   return res.status(400).json({ msg: 'Invalid credentials' });
    // }

    const token = jwt.sign({ userId: user._id.toString(), role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
    res.json({ token });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
