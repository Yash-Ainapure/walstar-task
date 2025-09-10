const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { protect, requireSuperadmin } = require('../middleware/authMiddleware');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

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

// update session name
router.patch('/:userId/session/:sessionId', protect, routeController.updateSessionName);

// delete session
router.delete('/:userId/session/:sessionId', protect, routeController.deleteSession);

// Session creation route
router.post('/me/session', protect, routeController.createSession);

// image upload for session
router.post('/:userId/session/:sessionId/image', protect, upload.single('image'), routeController.uploadSessionImage);

// get images for session
router.get('/:userId/session/:sessionId/images', protect, routeController.getSessionImages);

module.exports = router;
