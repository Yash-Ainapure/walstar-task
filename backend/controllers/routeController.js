const mongoose = require('mongoose');
const Route = require('../models/Route');

exports.syncRoute = async (req, res) => {
  const { route: locations } = req.body;

  console.log('--- BACKEND SYNC ---');
  console.log(`Received ${locations ? locations.length : 0} locations to sync.`);
  console.log('Data:', JSON.stringify(locations, null, 2));
  const date = new Date().toISOString().split('T')[0]; // Use current date
  const userId = req.user.id;

  if (!locations || locations.length === 0) {
    return res.status(400).json({ msg: 'No locations provided' });
  }

  // Sort locations by timestamp to find the start and end times
  locations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const session = {
    sessionId: new mongoose.Types.ObjectId().toString(),
    startTime: locations[0].timestamp,
    endTime: locations[locations.length - 1].timestamp,
    locations: locations,
  };

  try {
    // Find a route document for the user and date, or create a new one
    let route = await Route.findOneAndUpdate(
      { user: userId, date },
      { $push: { sessions: session } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ msg: 'Route data synced successfully', route });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
