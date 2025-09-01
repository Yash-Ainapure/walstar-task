// controllers/routeController.js
const Route = require('../models/Route');
const User = require('../models/User');

// Helper: convert incoming ISO to Date (UTC) and IST string
function toUTCandIST(isodate) {
  const d = isodate ? new Date(isodate) : new Date();
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
exports.syncRoute = async (req, res) => {
  try {
    const authUser = req.user; // { id, username, role }
    const { route: routeArr, sessionId: providedSessionId, username: targetUsername } = req.body;

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

    // Map locations to stored format (timestampUTC + timestampIST)
    const storedLocations = routeArr.map(loc => {
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

    const routeDoc = await ensureRouteDoc(ownerId);
    if (!routeDoc.dates.has(dateKey)) {
      routeDoc.dates.set(dateKey, { sessions: [] });
    }

    routeDoc.dates.get(dateKey).sessions.push({
      sessionId,
      startTime,
      endTime,
      locations: storedLocations
    });

    await routeDoc.save();

    return res.json({ msg: 'Route data synced successfully', sessionId, date: dateKey });
  } catch (err) {
    console.error('syncRoute error', err);
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
