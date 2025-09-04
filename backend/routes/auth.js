const express = require('express');
const router = express.Router();
const { register, login, getMe, updateMe, updateMyPhoto, updateMyPhotoBase64 } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Register & Login
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.put('/me/photo', protect, upload.single('profileImage'), updateMyPhoto);
router.put('/me/photobase64', protect, updateMyPhotoBase64);


module.exports = router;
