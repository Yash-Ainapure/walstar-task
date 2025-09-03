const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestampUTC: { type: Date, required: true },
  timestampIST: { type: String, required: true }
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  locations: [locationSchema],
  name: { type: String }
}, { _id: false });

const routeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  dates: {
    type: Map,
    of: {
      sessions: [sessionSchema]
    },
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Route', routeSchema, 'web-routes');