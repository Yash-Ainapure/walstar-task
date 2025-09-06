const User = require('../models/User');
const bcrypt = require('bcrypt');
const cloudinary = require('../config/cloudinary');

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

    let photoUrl = null;
    let photoId = null;

    if (req.file) {
      photoUrl = req.file.path;                // Cloudinary URL
      photoId = req.file.filename || req.file.public_id; // Cloudinary public_id
    }

    const user = new User({
      username,
      passwordHash,
      name,
      phone,
      address,
      role,
      photoUrl,
      photoId
    });
    await user.save();

    res.status(201).json({
      msg: 'User created',
      user: { ...user.toObject(), passwordHash: undefined }
    });
  } catch (err) {
    console.error('createUser error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};


exports.updateUser = async (req, res) => {
  try {
    const { username, password, name, phone, address, role } = req.body;

    // Fetch user first (so we can access old photoId if needed)
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const update = { username, name, phone, address, role };

    if (password) {
      update.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // If new image uploaded → delete old one first
    if (req.file) {
      if (user.photoId) {
        try {
          await cloudinary.uploader.destroy(user.photoId);
        } catch (err) {
          console.warn(`Failed to delete old image: ${user.photoId}`, err.message);
        }
      }
      update.photoUrl = req.file.path;      // new Cloudinary URL
      update.photoId = req.file.filename;   // new Cloudinary public_id
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).select('-passwordHash');

    res.json({ msg: 'User updated', user: updatedUser });
  } catch (err) {
    console.error('updateUser error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Delete image from Cloudinary if exists
    if (user.photoId) {
      await cloudinary.uploader.destroy(user.photoId);
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ msg: 'User deleted' });
  } catch (err) {
    console.error('deleteUser error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
