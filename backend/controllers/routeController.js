const Route = require('../models/Route');

exports.syncRoute = async (req, res) => {
  const { date, sessions } = req.body;
  const userId = req.user.id;

  try {
    // Find a route document for the user and date, or create a new one
    let route = await Route.findOneAndUpdate(
      { user: userId, date },
      { $push: { sessions: { $each: sessions } } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ msg: 'Route data synced successfully', route });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
