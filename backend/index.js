require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const routeRoutes = require('./routes/routes');
const userRoutes = require('./routes/users');
const cronRoutes = require('./routes/cron');

const app = express();

// ✅ Dynamic CORS setup
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://192.168.10.171:5173',
  '10.157.240.171:5173',
  'https://walstar-task.vercel.app',
  'https://walstar-task-jf7cthlpx-yash-ainapures-projects.vercel.app'
];

const corsOptions = {
  origin: (origin, callback) => {
    const walstarPattern = /^https:\/\/walstar-task-[^.]+\.vercel\.app$/;
    const yashProjectsPattern = /^https:\/\/.*-yash-ainapures-projects\.vercel\.app$/;

    if (!origin || allowedOrigins.includes(origin) || walstarPattern.test(origin) || yashProjectsPattern.test(origin)) {
      callback(null, true); // ✅ Allow request
    } else {
      callback(new Error('Not allowed by CORS')); // ❌ Block request
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/cron', cronRoutes);

// Health
app.get('/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
