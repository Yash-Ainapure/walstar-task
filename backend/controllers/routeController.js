const Route = require('../models/Route');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
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

function toUTCandIST(isodate) {
  let dateInput = isodate;

  // Handle MongoDB $date format: { '$date': '2025-08-31T10:20:00.000Z' }
  if (isodate && typeof isodate === 'object' && isodate.$date) {
    dateInput = isodate.$date;
  }

  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) throw new Error('Invalid date');
  const ist = d.toLocaleString('sv', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T') + '+05:30';
  return { timestampUTC: d, timestampIST: ist };
}

// Ensure Route doc exists for a user id
async function ensureRouteDoc(userId) {
  let route = await Route.findOne({ user: userId });
  if (!route) {
    route = new Route({ user: userId, dates: {} });
  }
  return route;
}

/**
 * syncRoute
 * - Primary endpoint used by driver app on CHECKOUT.
 * - Body: { route: [ { latitude, longitude, timestamp }, ... ], sessionId?: string, username?: string }
 * - If `username` is present and caller is superadmin, session will be stored for that username.
 * - Otherwise stores under the authenticated user (req.user.id).
 */
// backend/controllers/routeController.js
exports.syncRoute = async (req, res) => {
  try {
    const authUser = req.user; // { id, username, role }
    const { route: routeArr, sessionId: providedSessionId, username: targetUsername, tripName } = req.body;

    // Debug logging
    console.log('=== SYNC ROUTE DEBUG ===');
    console.log('Auth user:', authUser.username, 'ID:', authUser.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Trip name received:', tripName);
    console.log('Route array length:', routeArr ? routeArr.length : 'undefined');
    console.log('Provided session ID:', providedSessionId);

    if (!Array.isArray(routeArr) || routeArr.length === 0) {
      return res.status(400).json({ msg: 'No locations provided' });
    }

    // Determine owner (driver) for this session
    let ownerId = authUser.id;
    if (authUser.role === 'superadmin' && targetUsername) {
      const target = await User.findOne({ username: targetUsername });
      if (!target) return res.status(404).json({ msg: 'Target user not found' });
      ownerId = target._id.toString();
    }

    // Compute date key (IST) using first location timestamp
    const firstTs = new Date(routeArr[0].timestamp || Date.now());
    const dateKey = firstTs.toLocaleString('sv', { timeZone: 'Asia/Kolkata' }).split(' ')[0]; // YYYY-MM-DD

    const sessionId = providedSessionId || `sess-${Date.now().toString(36)}`;

    // Map new incoming locations to the correct format
    const storedLocations = routeArr.map((loc) => {
      const { timestampUTC, timestampIST } = toUTCandIST(loc.timestamp || new Date());
      return {
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestampUTC,
        timestampIST
      };
    });

    const startTime = storedLocations[0].timestampUTC;
    const endTime = storedLocations[storedLocations.length - 1].timestampUTC;

    // Fetch the main route document
    const routeDoc = await ensureRouteDoc(ownerId);

    // --- START: Data Cleaning and Healing Logic ---
    // Clean any existing data that was stored in the incorrect format
    if (routeDoc.dates && routeDoc.dates.size > 0) {
      // Use for...of loops for direct, in-place mutation
      for (const [dateKey, dateData] of routeDoc.dates.entries()) {
        if (dateData.sessions) {
          // Iterate through each session
          for (const session of dateData.sessions) {
            // Fix session start and end times if they are objects
            if (session.startTime && typeof session.startTime === 'object' && session.startTime.$date) {
              session.startTime = new Date(session.startTime.$date);
            }
            if (session.endTime && typeof session.endTime === 'object' && session.endTime.$date) {
              session.endTime = new Date(session.endTime.$date);
            }

            if (session.locations) {
              // Iterate through each location within the session
              for (const loc of session.locations) {
                // Fix the timestampUTC for each location
                if (loc.timestampUTC && typeof loc.timestampUTC === 'object' && loc.timestampUTC.$date) {
                  loc.timestampUTC = new Date(loc.timestampUTC.$date);
                }
              }
            }
          }
        }
      }
      
      // Explicitly tell Mongoose that the 'dates' map has been modified.
      routeDoc.markModified('dates');
    }
    // --- END: Data Cleaning and Healing Logic ---
    
    // Check if session already exists and update it, otherwise create new
    if (!routeDoc.dates.has(dateKey)) {
      routeDoc.dates.set(dateKey, { sessions: [] });
    }

    const dateData = routeDoc.dates.get(dateKey);
    console.log('Date key for sync:', dateKey);
    console.log('Existing sessions before sync:', dateData.sessions.map(s => ({ 
      sessionId: s.sessionId, 
      name: s.name, 
      locationCount: s.locations?.length || 0, 
      imageCount: s.images?.length || 0,
      startTime: s.startTime,
      endTime: s.endTime
    })));
    
    let existingSession = dateData.sessions.find(s => s.sessionId === sessionId);

    if (existingSession) {
      // Update existing session with locations and trip name
      console.log('=== UPDATING EXISTING SESSION ===');
      console.log('Found existing session:', existingSession.sessionId);
      console.log('Before update - Name:', existingSession.name, 'Locations:', existingSession.locations?.length || 0, 'Images:', existingSession.images?.length || 0);
      
      existingSession.endTime = endTime;
      existingSession.locations = storedLocations;
      
      // Only update name if tripName is provided and not empty
      if (tripName && tripName.trim()) {
        existingSession.name = tripName.trim();
      }
      
      console.log('After update - Name:', existingSession.name, 'Locations:', existingSession.locations?.length || 0, 'Images:', existingSession.images?.length || 0);
      console.log('=== SESSION UPDATE COMPLETED ===');
    } else {
      // Create new session
      console.log('=== CREATING NEW SESSION IN SYNC ===');
      console.log('No existing session found with ID:', sessionId);
      const sessionData = {
        sessionId,
        startTime,
        endTime,
        locations: storedLocations,
        images: []
      };

      // Only add name if tripName is provided and not empty
      if (tripName && tripName.trim()) {
        sessionData.name = tripName.trim();
      }

      dateData.sessions.push(sessionData);
      console.log('New session created in sync:', sessionId);
      console.log('New session details:', { name: sessionData.name, locationCount: sessionData.locations?.length || 0 });
    }
    
    console.log('Final sessions after sync:', dateData.sessions.map(s => ({ 
      sessionId: s.sessionId, 
      name: s.name, 
      locationCount: s.locations?.length || 0, 
      imageCount: s.images?.length || 0 
    })));

    await routeDoc.save();

    return res.json({ msg: 'Route data synced successfully', sessionId, date: dateKey, tripName });
  } catch (err) {
    // Note: Changed to console.warn to distinguish from critical crashes
    console.warn('syncRoute error', err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

/**
 * addSession
 * - Allows superadmin to add a session for a user (by userId param OR by passing username in body).
 * - Non-superadmin may add for themselves if req.params.userId === "me".
 */
exports.addSession = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId;

    // allow `me` to mean authenticated user
    if (targetUserId === 'me') targetUserId = authUser.id;

    // allow superadmin to pass username in body instead of userId param
    if (authUser.role === 'superadmin' && req.body.username) {
      const u = await User.findOne({ username: req.body.username });
      if (!u) return res.status(404).json({ msg: 'User not found by username' });
      targetUserId = u._id.toString();
    }

    // permission check
    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    const { date, sessionId, startTime, endTime, locations = [] } = req.body;
    if (!date || !sessionId || !startTime || !endTime) {
      return res.status(400).json({ msg: 'date, sessionId, startTime, endTime required' });
    }

    const routeDoc = await ensureRouteDoc(targetUserId);
    if (!routeDoc.dates.has(date)) routeDoc.dates.set(date, { sessions: [] });

    const storedLocations = locations.map(loc => {
      const { timestampUTC, timestampIST } = toUTCandIST(loc.timestamp || new Date());
      return { latitude: loc.latitude, longitude: loc.longitude, timestampUTC, timestampIST };
    });

    routeDoc.dates.get(date).sessions.push({
      sessionId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      locations: storedLocations
    });

    await routeDoc.save();
    return res.json({ msg: 'Session added', sessionId, date });
  } catch (err) {
    console.error('addSession error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * addLocation
 * - Append a single location to a session (useful if app pushes incremental points).
 * - URL: POST /api/routes/:userId/:date/:sessionId/location
 * - Permission: superadmin or same user (or userId === 'me').
 */
exports.addLocation = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId;
    if (targetUserId === 'me') targetUserId = authUser.id;

    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    const { date, sessionId } = req.params;
    const { latitude, longitude, timestamp } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ msg: 'latitude & longitude required' });
    }

    const routeDoc = await Route.findOne({ user: targetUserId });
    if (!routeDoc || !routeDoc.dates.has(date)) return res.status(404).json({ msg: 'Route/date not found' });

    const sessions = routeDoc.dates.get(date).sessions;
    const session = sessions.find(s => s.sessionId === sessionId);
    if (!session) return res.status(404).json({ msg: 'Session not found' });

    const { timestampUTC, timestampIST } = toUTCandIST(timestamp);
    session.locations.push({ latitude, longitude, timestampUTC, timestampIST });

    // update endTime if necessary
    if (timestampUTC > new Date(session.endTime)) session.endTime = timestampUTC;

    await routeDoc.save();
    res.json({ msg: 'Location added', sessionId });
  } catch (err) {
    console.error('addLocation error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * getDatesForUser
 * - GET /api/routes/:userId/dates
 * - Use :userId = "me" to view your own data, or provide actual userId (superadmin) after listing users.
 */
exports.getDatesForUser = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId === 'me' ? authUser.id : req.params.userId;

    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    const routeDoc = await Route.findOne({ user: targetUserId });
    if (!routeDoc) return res.json({ dates: [] });

    // `dates` is a Map, get all keys
    const dates = Array.from(routeDoc.dates.keys()).sort();

    res.json({ dates });
  } catch (err) {
    console.error('getDatesForUser', err);
    res.status(500).json({ msg: 'Server error' });
  }
};



/**
 * getSessionsByDate
 * - GET /api/routes/:userId/:date
 */
exports.getSessionsByDate = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId === 'me' ? authUser.id : req.params.userId;
    const date = req.params.date;

    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    const routeDoc = await Route.findOne({ user: targetUserId });
    if (!routeDoc) return res.json({ sessions: [] });

    const dateEntry = routeDoc.dates.get(date);
    const sessions = dateEntry ? dateEntry.sessions : [];

    res.json({ sessions });
  } catch (err) {
    console.error('getSessionsByDate', err);
    res.status(500).json({ msg: 'Server error' });
  }
};


/**
 * getSessionById
 * - GET /api/routes/:userId/session/:sessionId
 */
exports.getSessionById = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId;
    const { sessionId } = req.params;

    if (targetUserId === 'me') targetUserId = authUser.id;
    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    const routeDoc = await Route.findOne({ user: targetUserId });
    if (!routeDoc) return res.status(404).json({ msg: 'No route doc' });

    for (const [dateKey, dateBucket] of routeDoc.dates.entries()) {
      const found = (dateBucket.sessions || []).find(s => s.sessionId === sessionId);
      if (found) return res.json({ date: dateKey, session: found });
    }

    return res.status(404).json({ msg: 'Session not found' });
  } catch (err) {
    console.error('getSessionById', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * updateSessionName
 * - PATCH /api/routes/:userId/session/:sessionId
 * - Updates the name/title of a session
 */
exports.updateSessionName = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId;
    const { sessionId } = req.params;
    const { name } = req.body;

    if (targetUserId === 'me') targetUserId = authUser.id;
    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ msg: 'Name is required' });
    }

    const routeDoc = await Route.findOne({ user: targetUserId });
    if (!routeDoc) return res.status(404).json({ msg: 'No route doc' });

    let sessionFound = false;
    for (const [dateKey, dateBucket] of routeDoc.dates.entries()) {
      const session = (dateBucket.sessions || []).find(s => s.sessionId === sessionId);
      if (session) {
        session.name = name;
        sessionFound = true;
        break;
      }
    }

    if (!sessionFound) {
      return res.status(404).json({ msg: 'Session not found' });
    }

    await routeDoc.save();
    return res.json({ msg: 'Session name updated', sessionId, name });
  } catch (err) {
    console.error('updateSessionName error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * deleteSession
 * - DELETE /api/routes/:userId/session/:sessionId
 * - Deletes a session completely
 */
exports.deleteSession = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId;
    const { sessionId } = req.params;

    if (targetUserId === 'me') targetUserId = authUser.id;
    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    const routeDoc = await Route.findOne({ user: targetUserId });
    if (!routeDoc) return res.status(404).json({ msg: 'No route doc' });

    let sessionFound = false;
    for (const [dateKey, dateBucket] of routeDoc.dates.entries()) {
      const sessionIndex = (dateBucket.sessions || []).findIndex(s => s.sessionId === sessionId);
      if (sessionIndex !== -1) {
        dateBucket.sessions.splice(sessionIndex, 1);
        sessionFound = true;
        break;
      }
    }

    if (!sessionFound) {
      return res.status(404).json({ msg: 'Session not found' });
    }

    await routeDoc.save();
    return res.json({ msg: 'Session deleted', sessionId });
  } catch (err) {
    console.error('deleteSession error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * OSRM proxy (unchanged)
 * GET /api/routes/osrm/route?coords=lon,lat;lon,lat;...
 */
exports.osrmRouteProxy = async (req, res) => {
  try {
    const coords = req.query.coords;
    if (!coords) return res.status(400).json({ msg: 'coords required' });

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(coords)}?overview=full&geometries=geojson`;
    const r = await fetch(osrmUrl);
    if (!r.ok) throw new Error('OSRM network error');
    const json = await r.json();
    if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) throw new Error('OSRM no route');
    const route = json.routes[0];
    return res.json({
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry
    });
  } catch (err) {
    console.warn('OSRM error, returning fallback', err.message || err);
    // fallback: compute haversine
    try {
      const coords = req.query.coords || '';
      const latlon = coords.split(';').map(pair => {
        const [lon, lat] = pair.split(',').map(Number);
        return { lat, lon };
      });
      let fallback = 0;
      for (let i = 1; i < latlon.length; i++) fallback += haversineMeters(latlon[i - 1], latlon[i]);
      return res.json({ distanceMeters: null, durationSeconds: null, geometry: null, fallbackDistanceMeters: Math.round(fallback) });
    } catch (e) {
      console.error('osrm fallback error', e);
      return res.status(500).json({ msg: 'OSRM failed and fallback failed' });
    }
  }
};

/**
 * uploadSessionImage
 * - Upload an image for a specific session
 * - POST /api/routes/:userId/session/:sessionId/image
 */
exports.createSession = async (req, res) => {
  try {
    const authUser = req.user; // { id, username, role }
    const { date, sessionId, startTime, endTime, locations, name } = req.body;

    if (!sessionId) {
      return res.status(400).json({ msg: 'Session ID is required' });
    }

    console.log('=== CREATE SESSION DEBUG ===');
    console.log('Auth user:', authUser.username, 'ID:', authUser.id);
    console.log('Session data:', { date, sessionId, startTime, endTime, name });
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Use the same structure as syncRoute - find or create route document
    const routeDoc = await ensureRouteDoc(authUser.id);
    
    const dateKey = date || new Date().toISOString().split('T')[0];
    
    // Initialize date entry if it doesn't exist
    if (!routeDoc.dates.has(dateKey)) {
      routeDoc.dates.set(dateKey, { sessions: [] });
    }

    const dateData = routeDoc.dates.get(dateKey);
    console.log('Date key:', dateKey);
    console.log('Existing sessions for date:', dateData.sessions.map(s => ({ sessionId: s.sessionId, name: s.name, locationCount: s.locations?.length || 0, imageCount: s.images?.length || 0 })));
    
    // Check if session already exists
    const existingSession = dateData.sessions.find(s => s.sessionId === sessionId);
    if (existingSession) {
      console.log('Session already exists:', existingSession.sessionId);
      console.log('Existing session details:', { name: existingSession.name, locationCount: existingSession.locations?.length || 0, imageCount: existingSession.images?.length || 0 });
      return res.status(409).json({ msg: 'Session already exists' });
    }

    // Create new session using the same structure as syncRoute
    const { timestampUTC: startTimeUTC } = toUTCandIST(startTime || new Date());
    const { timestampUTC: endTimeUTC } = toUTCandIST(endTime || new Date());
    
    const newSession = {
      sessionId,
      startTime: startTimeUTC,
      endTime: endTimeUTC,
      locations: locations || [],
      images: []
    };

    // Only add name if provided and not empty
    if (name && name.trim()) {
      newSession.name = name.trim();
    }

    dateData.sessions.push(newSession);
    await routeDoc.save();

    console.log('=== SESSION CREATED SUCCESSFULLY ===');
    console.log('Session ID:', sessionId);
    console.log('Session details:', { name: newSession.name, locationCount: newSession.locations?.length || 0, imageCount: newSession.images?.length || 0 });
    console.log('Total sessions for date:', dateData.sessions.length);
    
    res.status(201).json({ 
      msg: 'Session created successfully',
      sessionId,
      session: newSession
    });

  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ msg: 'Server error creating session' });
  }
};

exports.uploadSessionImage = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId;
    const { sessionId } = req.params;
    const { type, description, latitude, longitude } = req.body;

    if (targetUserId === 'me') targetUserId = authUser.id;
    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: 'No image file provided' });
    }

    if (!['start_speedometer', 'end_speedometer', 'journey_stop'].includes(type)) {
      return res.status(400).json({ msg: 'Invalid image type' });
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'walstar-journey-images',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
            { format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Generate thumbnail URL
    const thumbnailUrl = cloudinary.url(uploadResult.public_id, {
      width: 300,
      height: 300,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    });

    // Find the route document and session
    const routeDoc = await Route.findOne({ user: targetUserId });
    if (!routeDoc) return res.status(404).json({ msg: 'No route doc' });

    let sessionFound = false;
    const { timestampUTC, timestampIST } = toUTCandIST(new Date());

    for (const [dateKey, dateBucket] of routeDoc.dates.entries()) {
      const session = (dateBucket.sessions || []).find(s => s.sessionId === sessionId);
      if (session) {
        if (!session.images) session.images = [];
        
        session.images.push({
          cloudinaryId: uploadResult.public_id,
          url: uploadResult.secure_url,
          thumbnailUrl,
          type,
          timestampUTC,
          timestampIST,
          location: latitude && longitude ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) } : undefined,
          description: description || undefined
        });
        
        sessionFound = true;
        break;
      }
    }

    if (!sessionFound) {
      // Clean up uploaded image if session not found
      await cloudinary.uploader.destroy(uploadResult.public_id);
      return res.status(404).json({ msg: 'Session not found' });
    }

    await routeDoc.save();

    return res.json({
      msg: 'Image uploaded successfully',
      image: {
        cloudinaryId: uploadResult.public_id,
        url: uploadResult.secure_url,
        thumbnailUrl,
        type,
        timestamp: timestampIST
      }
    });
  } catch (err) {
    console.error('uploadSessionImage error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * getSessionImages
 * - Get all images for a specific session
 * - GET /api/routes/:userId/session/:sessionId/images
 */
exports.getSessionImages = async (req, res) => {
  try {
    const authUser = req.user;
    let targetUserId = req.params.userId;
    const { sessionId } = req.params;

    if (targetUserId === 'me') targetUserId = authUser.id;
    if (authUser.role !== 'superadmin' && authUser.id !== targetUserId) {
      return res.status(403).json({ msg: 'No permission' });
    }

    const routeDoc = await Route.findOne({ user: targetUserId });
    if (!routeDoc) return res.status(404).json({ msg: 'No route doc' });

    for (const [dateKey, dateBucket] of routeDoc.dates.entries()) {
      const session = (dateBucket.sessions || []).find(s => s.sessionId === sessionId);
      if (session) {
        return res.json({ images: session.images || [] });
      }
    }

    return res.status(404).json({ msg: 'Session not found' });
  } catch (err) {
    console.error('getSessionImages error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = v => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

// Export multer upload middleware
exports.uploadMiddleware = upload.single('image');
