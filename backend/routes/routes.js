const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { syncRoute } = require('../controllers/routeController');

// @route   POST api/routes/sync
// @desc    Sync route data
// @access  Private
router.post('/sync', auth, syncRoute);

module.exports = router;
