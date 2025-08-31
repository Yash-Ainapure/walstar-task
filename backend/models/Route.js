const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  // Keep both UTC Date (for calculations) and IST string (for "store in Indian time only" requirement)
  timestampUTC: { type: Date, required: true },
  timestampIST: { type: String, required: true }
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  locations: [locationSchema]
}, { _id: false });

const dateSessionsSchema = new mongoose.Schema({
  sessions: [sessionSchema]
}, { _id: false });

// route document: one per user (unique user)
const routeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Map of dateStr -> { sessions: [...] }
  dates: {
    type: Map,
    of: dateSessionsSchema,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Route', routeSchema,'web-routes');
