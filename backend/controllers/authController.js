const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

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
    // Check if a file was actually uploaded
    if (!req.file) {
      return res.status(400).json({ msg: 'Please upload an image file.' });
    }

    // The 'protect' middleware gives us the user's ID
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Update the photoUrl field with the path to the new file
    user.photoUrl = `/uploads/${req.file.filename}`;

    // Save the updated user document
    await user.save();

    // Send back the updated user data (without the password)
    const updatedUser = await User.findById(req.user.id).select('-passwordHash');
    res.json(updatedUser);

  } catch (err) {
    console.error('updateMyPhoto error', err);
    res.status(500).json({ msg: 'Server Error' });
  }
};


/**
 * @desc    Update user photo from a Base64 string
 * @route   PUT /api/auth/me/photobase64
 * @access  Private
 */
exports.updateMyPhotoBase64 = async (req, res) => {
  try {
    // 1. Get the Base64 string from the request body.
    const { photo } = req.body;

    if (!photo) {
      return res.status(400).json({ msg: 'No photo data was sent.' });
    }

    // 2. Decode the Base64 string.
    // The string format is "data:[<mediatype>];base64,[<data>]"
    // Example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
    const matches = photo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
      return res.status(400).json({ msg: 'Invalid Base64 string format.' });
    }

    const imageBuffer = Buffer.from(matches[2], 'base64'); // This converts the string to binary data.
    const mimeType = matches[1]; // e.g., 'image/jpeg'
    const extension = mimeType.split('/')[1]; // e.g., 'jpeg'

    // 3. Create a unique filename and define the path to save the file.
    const filename = `profileImage-${Date.now()}-${uuidv4()}.${extension}`;

    // This creates a path like: /your_project_folder/backend/public/uploads/filename.jpeg
    const uploadPath = path.join(__dirname, '..', 'uploads', filename);

    // Ensure the 'uploads' directory exists before trying to save the file.
    const dir = path.dirname(uploadPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 4. Save the decoded image data to the file system.
    fs.writeFileSync(uploadPath, imageBuffer);

    // 5. Update the user's record in the database with the new photo URL.
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    // IMPORTANT: The URL saved in the DB should be the web-accessible path, not the full system path.
    user.photoUrl = `/uploads/${filename}`;
    await user.save();

    // 6. Send back the updated user object so the frontend can update its state.
    const updatedUser = await User.findById(req.user.id).select('-passwordHash');
    res.json(updatedUser);

  } catch (err) {
    console.error('Error in updateMyPhotoBase64:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
};
