const express = require('express');
const router = express.Router();

// Cron ping route to keep the server alive
router.get('/ping', (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`Backend ping received at ${timestamp}`);
  
  res.status(200).json({
    message: 'Backend is alive',
    timestamp: timestamp,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

module.exports = router;
