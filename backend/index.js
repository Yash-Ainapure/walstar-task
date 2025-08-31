require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const routeRoutes = require('./routes/routes');
const userRoutes = require('./routes/users');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set in env. Set JWT_SECRET in .env file.');
}

connectDB(MONGO_URI);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/users', userRoutes);

// Health
app.get('/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
