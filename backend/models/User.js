const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String },
  phone: { type: String },
  address: { type: String },
  photoUrl: { type: String },
  photoId: { type: String },
  role: { type: String, enum: ['superadmin', 'driver'], default: 'driver' }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
