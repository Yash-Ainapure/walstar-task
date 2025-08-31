const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { protect, requireSuperadmin } = require('../middleware/authMiddleware');

// Driver sync (checkout) - authenticated (driver or superadmin)
router.post('/sync', protect, routeController.syncRoute);

// Admin or self session creation
router.post('/:userId/session', protect, routeController.addSession);

// append single location
router.post('/:userId/:date/:sessionId/location', protect, routeController.addLocation);

// list dates for user (use userId='me' to get current auth user's dates)
router.get('/:userId/dates', protect, routeController.getDatesForUser);

// osrm proxy (public)
router.get('/osrm/route', routeController.osrmRouteProxy);

// get sessions for a date
router.get('/:userId/:date', protect, routeController.getSessionsByDate);

// get session by sessionId
router.get('/:userId/session/:sessionId', protect, routeController.getSessionById);


module.exports = router;
