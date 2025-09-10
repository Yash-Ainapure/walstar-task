const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const cloudinary = require("../config/cloudinary");


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

    const token = jwt.sign({ userId: user._id.toString(), role: user.role }, jwtSecret);
    res.json({ token,user });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};


// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    // req.user.id is available from the 'protect' middleware
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('getMe error', err);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// @desc    Update current logged in user's profile
// @route   PUT /api/auth/me
// @access  Private
exports.updateMe = async (req, res) => {
  try {
    // Get the new fields from the request body
    const { username, name, address, phone } = req.body;

    // Build an object with the fields to update
    const updatedFields = { username, name, address, phone };

    // Find the user by the ID from the token and update them
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updatedFields },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('updateMe error', err);
    res.status(500).json({ msg: 'Server Error' });
  }
};



// ✅ NEW CONTROLLER FUNCTION FOR PHOTO UPLOAD
// @desc    Update current user's profile photo
// @route   PUT /api/auth/me/photo
// @access  Private
exports.updateMyPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Please upload an image file." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "user_profiles", // optional: store in a folder
    });

    // Save the Cloudinary URL in the user document
    user.photoUrl = result.secure_url;
    user.photoId = result.public_id;
    await user.save();

    const updatedUser = await User.findById(req.user.id).select("-passwordHash");
    res.json(updatedUser);
  } catch (err) {
    console.error("updateMyPhoto error", err);
    res.status(500).json({ msg: "Server Error" });
  }
};



/**
 * @desc    Update user photo from a Base64 string
 * @route   PUT /api/auth/me/photobase64
 * @access  Private
 */
exports.updateMyPhotoBase64 = async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) {
      return res.status(400).json({ msg: "No photo data was sent." });
    }

    // Upload Base64 string directly
    const result = await cloudinary.uploader.upload(photo, {
      folder: "user_profiles",
    });

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    user.photoUrl = result.secure_url;
    user.photoId = result.public_id;
    await user.save();

    const updatedUser = await User.findById(req.user.id).select("-passwordHash");
    res.json(updatedUser);
  } catch (err) {
    console.error("Error in updateMyPhotoBase64:", err);
    res.status(500).json({ msg: "Server Error" });
  }
};
