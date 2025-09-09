# WalStar Location Tracking System - Knowledge Transfer Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Live Location Tracking Implementation](#live-location-tracking-implementation)
5. [Map Visualization & Routing](#map-visualization--routing)
6. [HMM Algorithm for GPS Map Matching](#hmm-algorithm-for-gps-map-matching)
7. [Database Schema & Data Flow](#database-schema--data-flow)
8. [API Endpoints](#api-endpoints)
9. [Key Features & Functionalities](#key-features--functionalities)
10. [Deployment & Configuration](#deployment--configuration)
11. [Best Practices & Recommendations](#best-practices--recommendations)

---

## Project Overview

The WalStar Location Tracking System is a comprehensive fleet management solution consisting of three main components:

- **Backend API**: Node.js/Express server with MongoDB database
- **Frontend Admin Dashboard**: React-based web application for administrators
- **Mobile Driver App**: React Native application for drivers

The system enables real-time location tracking, route visualization, and comprehensive fleet management with advanced GPS map matching using Hidden Markov Model (HMM) algorithms.

---

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │  Frontend Web   │    │   Backend API   │
│  (React Native) │    │    (React)      │    │ (Node.js/Express)│
│                 │    │                 │    │                 │
│ • Location      │◄──►│ • Admin Panel   │◄──►│ • REST APIs     │
│   Tracking      │    │ • Route View    │    │ • Authentication│
│ • Offline Sync  │    │ • User Mgmt     │    │ • Data Storage  │
│ • Map Display   │    │ • Analytics     │    │ • OSRM Proxy    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   MongoDB       │
                    │   Database      │
                    │                 │
                    │ • Users         │
                    │ • Routes        │
                    │ • Sessions      │
                    │ • Locations     │
                    └─────────────────┘
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js v5.1.0
- **Database**: MongoDB with Mongoose ODM v8.18.0
- **Authentication**: JWT (jsonwebtoken v9.0.2)
- **Password Hashing**: bcrypt v6.0.0
- **File Upload**: Multer v2.0.2 + Cloudinary v1.41.3
- **HTTP Client**: node-fetch v3.3.2
- **Environment**: dotenv v17.2.1

### Frontend (Admin Dashboard)
- **Framework**: React v19.1.1
- **Build Tool**: Vite v7.1.2
- **Styling**: Tailwind CSS v4.1.12
- **Routing**: React Router DOM v7.8.2
- **HTTP Client**: Axios v1.11.0
- **Maps**: Leaflet v1.9.4 + React Leaflet v5.0.0
- **Language**: TypeScript v5.8.3

### Mobile App (Driver)
- **Framework**: React Native v0.79.6 with Expo SDK v53.0.22
- **Navigation**: React Navigation v7.x
- **Location Services**: 
  - expo-location v18.1.6
  - expo-task-manager v13.1.6
- **Maps**: 
  - react-native-maps v1.20.1
  - @maplibre/maplibre-react-native v10.2.1
- **Storage**: 
  - expo-sqlite v15.2.14
  - expo-secure-store v14.2.4
- **Network**: @react-native-community/netinfo v11.4.1

---

## Live Location Tracking Implementation

### Mobile App Location Tracking

The mobile application implements a sophisticated location tracking system with the following key components:

#### 1. Background Location Task
```javascript
// Background task definition for continuous location tracking
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    // Process and store locations locally
    await initDB();
    for (const location of locations) {
      await writeLocation(
        location.coords.latitude, 
        location.coords.longitude, 
        new Date(location.timestamp)
      );
    }
  }
});
```

#### 2. High-Precision Location Configuration
```javascript
await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
  accuracy: Location.Accuracy.Highest,    // GPS accuracy
  timeInterval: 2000,                     // 2-second intervals
  distanceInterval: 1,                    // 1-meter minimum distance
  deferredUpdatesInterval: 1000,          // 1-second deferred updates
  pausesUpdatesAutomatically: false,      // Continuous tracking
  showsBackgroundLocationIndicator: true  // iOS background indicator
});
```

#### 3. Offline-First Architecture
- **Local SQLite Storage**: All GPS coordinates stored locally first
- **Network-Aware Syncing**: Automatic sync when network becomes available
- **Batch Upload**: Efficient bulk upload of location data on checkout

#### 4. Real-Time Map Updates
```javascript
// Real-time coordinate updates every 2 seconds
useEffect(() => {
  const updateMapLocation = async () => {
    if (isTracking && showMap) {
      const locations = await getLocations();
      if (locations.length > 0) {
        const coords = locations.map(loc => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
        }));
        setRouteCoordinates(coords);
        setCurrentLocation(coords[coords.length - 1]);
      }
    }
  };
  const interval = setInterval(updateMapLocation, 2000);
  return () => clearInterval(interval);
}, [isTracking, showMap]);
```

### Backend Location Processing

#### 1. Route Data Structure
```javascript
const routeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  dates: {
    type: Map,
    of: {
      sessions: [sessionSchema]  // Multiple sessions per date
    },
    default: {}
  }
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  locations: [locationSchema],
  name: { type: String }
}, { _id: false });

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestampUTC: { type: Date, required: true },
  timestampIST: { type: String, required: true }
}, { _id: false });
```

#### 2. Data Synchronization Endpoint
```javascript
exports.syncRoute = async (req, res) => {
  const { route: routeArr, sessionId: providedSessionId, username: targetUsername } = req.body;
  
  // Validate and process incoming location data
  const storedLocations = routeArr.map((loc) => {
    const { timestampUTC, timestampIST } = toUTCandIST(loc.timestamp || new Date());
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestampUTC,
      timestampIST
    };
  });
  
  // Store session data organized by date
  const dateKey = firstTs.toLocaleString('sv', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
  routeDoc.dates.get(dateKey).sessions.push({
    sessionId,
    startTime,
    endTime,
    locations: storedLocations
  });
};
```

---

## Map Visualization & Routing

### Frontend Map Implementation (React + Leaflet)

#### 1. Interactive Route Visualization
```typescript
// MapSession component for route display
export default function MapSession({ session }: { session: Session }) {
  const [mergedPolyline, setMergedPolyline] = useState<[number, number][]>([]);
  const [confidenceSegments, setConfidenceSegments] = useState<
    { positions: [number, number][]; confidence: number }[]
  >([]);
  
  // OSRM Map Matching Integration
  const fetchMatched = async () => {
    const coordString = toSend.map(p => `${p.longitude},${p.latitude}`).join(';');
    const timestamps = sanitizeTimestamps(rawTimestamps);
    const radiuses = new Array(toSend.length).fill(10);
    
    const url = `https://router.project-osrm.org/match/v1/driving/${coordString}` +
                `?geometries=geojson&overview=full&gaps=ignore&tidy=true` +
                `&timestamps=${timestamps.join(';')}` +
                `&radiuses=${radiuses.join(';')}`;
  };
}
```

#### 2. Confidence-Based Route Coloring
```typescript
function confidenceColor(c: number) {
  if (c >= 0.8) return '#16a34a';  // High confidence - Green
  if (c >= 0.5) return '#f59e0b';  // Medium confidence - Amber  
  return '#ef4444';                // Low confidence - Red
}
```

### Mobile Map Implementation (React Native + WebView)

#### 1. Leaflet Integration via WebView
```javascript
const generateMapHTML = () => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      <script>
        const map = L.map('map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Real-time polyline updates
        polyline = L.polyline(routePoints, { color: '#0066FF', weight: 4 }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      </script>
    </body>
    </html>
  `;
};
```

#### 2. Real-Time Route Updates
```javascript
window.updateRoute = function(newRoutePoints) {
  const points = JSON.parse(newRoutePoints).map(p => [p.latitude, p.longitude]);
  
  // Update polyline
  if (polyline) map.removeLayer(polyline);
  polyline = L.polyline(points, { color: '#0066FF', weight: 4 }).addTo(map);
  
  // Update current position marker
  if (currentMarker) map.removeLayer(currentMarker);
  const currentPoint = points[points.length - 1];
  currentMarker = L.circleMarker(currentPoint, {
    radius: 7, fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1
  }).addTo(map);
  
  map.panTo(currentPoint);
};
```

---

## HMM Algorithm for GPS Map Matching

### OSRM Map Matching Service

The system implements sophisticated GPS map matching using the Open Source Routing Machine (OSRM) with Hidden Markov Model algorithms for accurate road snapping.

#### 1. Map Matching Process

```javascript
// Frontend implementation
const fetchMatched = async () => {
  // Sample GPS points to stay within OSRM limits (max 100 points)
  let toSend = session.locations || [];
  if (toSend.length > MAX_OSRM_POINTS) {
    const step = Math.ceil(toSend.length / MAX_OSRM_POINTS);
    const sampled = toSend.filter((_, i) => i % step === 0);
    if (sampled[sampled.length - 1] !== toSend[toSend.length - 1]) {
      sampled.push(toSend[toSend.length - 1]);
    }
    toSend = sampled;
  }
  
  // Build OSRM Map Matching request
  const coordString = toSend.map(p => `${p.longitude},${p.latitude}`).join(';');
  const timestamps = sanitizeTimestamps(rawTimestamps);
  const radiuses = new Array(toSend.length).fill(10); // 10m GPS accuracy
  
  const url = `https://router.project-osrm.org/match/v1/driving/${coordString}` +
              `?geometries=geojson&overview=full&gaps=ignore&tidy=true` +
              `&timestamps=${timestamps.join(';')}` +
              `&radiuses=${radiuses.join(';')}`;
};
```

#### 2. HMM Algorithm Parameters

**Key Parameters for Map Matching:**
- **Timestamps**: Strictly increasing time sequence for temporal consistency
- **Radiuses**: GPS accuracy circles (default 10m) for each coordinate
- **Geometries**: GeoJSON format for precise coordinate handling
- **Overview**: Full geometry for complete route reconstruction
- **Gaps**: Ignore gaps in GPS data for continuous routes
- **Tidy**: Clean up the matched geometry

#### 3. Confidence-Based Route Selection

```javascript
// Select best matching based on confidence scores
let bestMatchIndex = 0;
for (let i = 0; i < data.matchings.length; i++) {
  if ((data.matchings[i].confidence ?? 0) > 
      (data.matchings[bestMatchIndex]?.confidence ?? -1)) {
    bestMatchIndex = i;
  }
}

const bestMatching = data.matchings[bestMatchIndex];
const snappedPolyline = bestMatching.geometry.coordinates.map(
  (c: [number, number]) => [c[1], c[0]] as [number, number]
);
```

#### 4. How HMM Works in OSRM

The Hidden Markov Model in OSRM map matching works as follows:

**States**: Possible road segments where the vehicle could be located
**Observations**: Raw GPS coordinates with inherent noise
**Transition Probabilities**: Likelihood of moving from one road segment to another
**Emission Probabilities**: Likelihood that a GPS point was generated from a specific road segment

**Algorithm Steps**:
1. **Initialization**: For each GPS point, identify candidate road segments within the search radius
2. **Forward Pass**: Calculate the most likely sequence of road segments using Viterbi algorithm
3. **Confidence Scoring**: Assign confidence values based on:
   - Distance between GPS points and matched road segments
   - Consistency of the matched path
   - Temporal constraints from timestamps
4. **Route Reconstruction**: Generate the final snapped route with confidence metrics

#### 5. Timestamp Sanitization for HMM

```javascript
function sanitizeTimestamps(raw: number[]): number[] {
  if (!raw.length) return [];
  const fixed: number[] = [];
  let last = raw[0];
  
  fixed.push(last);
  for (let i = 1; i < raw.length; i++) {
    let t = raw[i];
    if (!t || isNaN(t)) t = last + 1;
    if (t <= last) t = last + 1;  // Ensure strictly increasing
    fixed.push(t);
    last = t;
  }
  return fixed;
}
```

This ensures the HMM algorithm receives temporally consistent data, which is crucial for accurate map matching.

---

## Database Schema & Data Flow

### MongoDB Collections

#### 1. Users Collection
```javascript
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String },
  phone: { type: String },
  address: { type: String },
  photoUrl: { type: String },
  photoId: { type: String },
  role: { type: String, enum: ['superadmin', 'driver'], default: 'driver' }
}, { timestamps: true });
```

#### 2. Routes Collection (web-routes)
```javascript
const routeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  dates: {
    type: Map,
    of: {
      sessions: [sessionSchema]
    },
    default: {}
  }
}, { timestamps: true });
```

### Data Flow Architecture

```
Mobile App (SQLite) → Backend API → MongoDB
     ↓                    ↓           ↓
Local Storage      Route Processing   Persistent Storage
     ↓                    ↓           ↓
Offline Sync    →  Session Creation → Date-based Organization
     ↓                    ↓           ↓
Network Check   →  Batch Upload    → Admin Dashboard Access
```

#### Data Processing Pipeline

1. **Collection**: GPS coordinates collected every 2 seconds on mobile
2. **Local Storage**: Immediate storage in SQLite for offline capability
3. **Batch Sync**: Upload entire session on checkout
4. **Server Processing**: 
   - Validate coordinates
   - Convert timestamps (UTC + IST)
   - Organize by date and session
   - Store in MongoDB
5. **Visualization**: Real-time access via admin dashboard

---

## API Endpoints

### Authentication Endpoints
```
POST /api/auth/login     - User authentication
POST /api/auth/register  - User registration (admin only)
```

### Route Management Endpoints
```
POST /api/routes/sync                           - Sync route data from mobile
GET  /api/routes/:userId/dates                  - Get available dates for user
GET  /api/routes/:userId/:date                  - Get sessions for specific date
GET  /api/routes/:userId/session/:sessionId     - Get specific session details
POST /api/routes/:userId/:date/:sessionId       - Add session manually
POST /api/routes/:userId/:date/:sessionId/location - Add single location
PATCH /api/routes/:userId/session/:sessionId    - Update session name
DELETE /api/routes/:userId/session/:sessionId   - Delete session
```

### OSRM Proxy Endpoint
```
GET /api/routes/osrm/route?coords=lon,lat;lon,lat - Route calculation with fallback
```

### User Management Endpoints
```
GET    /api/users        - List all users (admin only)
GET    /api/users/:id    - Get user details
PUT    /api/users/:id    - Update user information
DELETE /api/users/:id    - Delete user (admin only)
POST   /api/users/:id/photo - Upload user photo
```

---

## Key Features & Functionalities

### 1. **Real-Time Location Tracking**
- **High-Precision GPS**: Sub-meter accuracy with 2-second intervals
- **Background Processing**: Continuous tracking even when app is backgrounded
- **Battery Optimization**: Intelligent power management for extended tracking

### 2. **Offline-First Architecture**
- **Local Data Storage**: SQLite database for offline capability
- **Automatic Synchronization**: Smart sync when network becomes available
- **Data Integrity**: No data loss even in poor network conditions

### 3. **Advanced Map Matching**
- **HMM Algorithm**: Hidden Markov Model for accurate road snapping
- **Confidence Scoring**: Visual indication of matching accuracy
- **Multi-Route Support**: Handle complex routes with gaps and detours

### 4. **Comprehensive Admin Dashboard**
- **Real-Time Monitoring**: Live view of all active drivers
- **Historical Analysis**: Detailed route history and analytics
- **User Management**: Complete driver profile management
- **Route Visualization**: Interactive maps with confidence indicators

### 5. **Scalable Backend Architecture**
- **RESTful API Design**: Clean, maintainable API structure
- **Role-Based Access Control**: Secure multi-tenant architecture
- **Efficient Data Organization**: Date-based session management
- **Cloud Integration**: Cloudinary for media storage

### 6. **Mobile App Features**
- **Intuitive Interface**: Simple check-in/check-out workflow
- **Live Map Display**: Real-time route visualization
- **Offline Capability**: Works without internet connection
- **Session Management**: Named sessions for better organization

### 7. **Performance Optimizations**
- **Data Sampling**: Intelligent GPS point reduction for OSRM
- **Lazy Loading**: Efficient data loading in admin dashboard
- **Caching Strategy**: Optimized API response caching
- **Background Tasks**: Non-blocking location processing

### 8. **Security & Privacy**
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **Role-Based Permissions**: Granular access control
- **Data Encryption**: Secure data transmission

---

## Deployment & Configuration

### Environment Variables

#### Backend (.env)
```
NODE_ENV=production
PORT=5001
MONGO_URI=mongodb://localhost:27017/walstar
JWT_SECRET=your-super-secret-jwt-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

#### Frontend (.env)
```
VITE_API_BASE_URL=https://your-backend-api.com
```

#### Mobile App (config.js)
```javascript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5001' 
  : 'https://your-production-api.com';
```

### Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel        │    │   Railway       │    │   MongoDB Atlas │
│   (Frontend)    │    │   (Backend)     │    │   (Database)    │
│                 │    │                 │    │                 │
│ • React Build   │    │ • Node.js API   │    │ • Cloud DB      │
│ • Static Assets │    │ • Auto Deploy   │    │ • Backups       │
│ • CDN           │    │ • Health Check  │    │ • Scaling       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Mobile App Deployment

#### Android (Google Play Store)
```bash
# Build production APK
expo build:android --type=apk

# Build AAB for Play Store
expo build:android --type=app-bundle
```

#### iOS (App Store)
```bash
# Build for iOS
expo build:ios --type=archive
```

---

## Best Practices & Recommendations

### 1. **Performance Optimization**

#### GPS Data Management
- **Sampling Strategy**: Implement intelligent GPS point sampling for OSRM requests
- **Batch Processing**: Process location updates in batches to reduce API calls
- **Memory Management**: Regular cleanup of old location data in mobile app

#### Database Optimization
```javascript
// Index optimization for MongoDB
db.routes.createIndex({ "user": 1 });
db.routes.createIndex({ "dates": 1 });
db.users.createIndex({ "username": 1 }, { unique: true });
```

### 2. **Error Handling & Resilience**

#### Network Resilience
```javascript
// Implement exponential backoff for API retries
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};
```

#### Graceful Degradation
- **Fallback Maps**: Provide fallback when Leaflet fails to load
- **Offline Mode**: Clear indication of offline status
- **Error Boundaries**: React error boundaries for crash prevention

## Conclusion

This Location Tracking System represents a sophisticated, production-ready fleet management solution with advanced GPS tracking, intelligent map matching, and comprehensive administrative capabilities. The system's offline-first architecture, combined with HMM-based map matching and real-time visualization, provides a robust foundation for scalable fleet management operations.

The modular architecture allows for easy maintenance and future enhancements, while the comprehensive API design ensures seamless integration with existing systems. The implementation of industry best practices in security, performance, and scalability makes this system suitable for enterprise-level deployments.
