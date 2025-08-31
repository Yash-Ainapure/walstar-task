require('dotenv').config();
const connectDB = require('../config/db');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Route = require('../models/Route');

async function seed() {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log('Connected to DB for seeding');

    // Optional: clear existing
    await User.deleteMany({});
    await Route.deleteMany({});

    const passwordHash = await bcrypt.hash('supersecret', 10);
    const superAdmin = await User.create({
      username: 'superadmin@example.com',
      passwordHash,
      name: 'Super Admin',
      role: 'superadmin'
    });

    console.log('Super Admin created:', superAdmin.username);

    const exampleRoute = await Route.create({
      user: superAdmin._id,
      dates: {
        '2025-08-31': {
          sessions: [
            {
              sessionId: 'sess-003',
              startTime: new Date('2025-08-31T04:08:53.038Z'),
              endTime: new Date('2025-08-31T04:09:08.486Z'),
              locations: [
                {
                  latitude: 16.7280717,
                  longitude: 74.2425623,
                  timestampUTC: new Date('2025-08-31T04:08:53.038Z'),
                  timestampIST: new Date('2025-08-31T04:08:53.038Z').toLocaleString('sv', { timeZone: 'Asia/Kolkata' }) + '+05:30'
                },
                {
                  latitude: 16.7280738,
                  longitude: 74.2425616,
                  timestampUTC: new Date('2025-08-31T04:09:08.486Z'),
                  timestampIST: new Date('2025-08-31T04:09:08.486Z').toLocaleString('sv', { timeZone: 'Asia/Kolkata' }) + '+05:30'
                }
              ]
            }
          ]
        }
      }
    });

    console.log('Example Route created for superadmin, saved to collection "web-routes".');
    process.exit(0);
  } catch (err) {
    console.error('Seed error', err);
    process.exit(1);
  }
}

seed();
