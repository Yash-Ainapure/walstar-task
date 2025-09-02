const User = require('../models/User');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash');
    res.json(users);
  } catch (err) {
    console.error('getAllUsers error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('getUserById error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, password, name, phone, address, role } = req.body;
    if (!username || !password) return res.status(400).json({ msg: 'username and password required' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ msg: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Handle uploaded image
    let photoUrl = null;
    if (req.file) {
      // Generate URL for the uploaded file
      photoUrl = `/uploads/${req.file.filename}`;
    }

    const user = new User({ username, passwordHash, name, phone, address, photoUrl, role });
    await user.save();
    res.status(201).json({ msg: 'User created', user: { ...user.toObject(), passwordHash: undefined } });
  } catch (err) {
    console.error('createUser error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { username, password, name, phone, address, role } = req.body;
    const update = { username, name, phone, address, role };

    if (password) {
      update.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // Handle uploaded image
    if (req.file) {
      update.photoUrl = `/uploads/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'User updated', user });
  } catch (err) {
    console.error('updateUser error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: 'User deleted' });
  } catch (err) {
    console.error('deleteUser error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
