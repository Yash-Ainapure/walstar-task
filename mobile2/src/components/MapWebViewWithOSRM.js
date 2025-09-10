// MapWebViewWithOSRM.js - Optimized version with OSRM integration and incremental updates
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import axios from "axios";
import BlinkingCircle from "./BlinkingCircle";

const MAX_OSRM_POINTS = 100;
const OSRM_BATCH_SIZE = 20; // Process coordinates in batches for incremental updates

const MapWebViewWithOSRM = ({ currentLocation, routeCoordinates, isVisible, isTracking, imageMarkers = [], onImageMarkerPress }) => {
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef(null);
  const lastRouteLength = useRef(0);
  const lastImageMarkersLength = useRef(0);
  const [matchedRoute, setMatchedRoute] = useState([]);
  const [confidenceSegments, setConfidenceSegments] = useState([]);
  const [isProcessingOSRM, setIsProcessingOSRM] = useState(false);
  const osrmCache = useRef(new Map());

  if (!isVisible || !currentLocation) return null;

  // Coordinate validation
  const validateCoordinate = (coord) =>
    coord &&
    typeof coord.latitude === "number" &&
    typeof coord.longitude === "number" &&
    !isNaN(coord.latitude) &&
    !isNaN(coord.longitude) &&
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180;

  // Sanitize timestamps for OSRM
  const sanitizeTimestamps = (raw) => {
    if (!raw.length) return [];
    const fixed = [];
    let last = raw[0];
    fixed.push(last);
    for (let i = 1; i < raw.length; i++) {
      let t = raw[i];
      if (!t || isNaN(t)) t = last + 1;
      if (t <= last) t = last + 1;
      fixed.push(t);
      last = t;
    }
    return fixed;
  };

  // OSRM Match service integration
  const matchCoordinatesToRoads = async (coordinates, useCache = true) => {
    if (!coordinates || coordinates.length < 2) {
      return { matchedRoute: coordinates.map(c => [c.latitude, c.longitude]), confidence: 1 };
    }

    // Generate cache key
    const cacheKey = coordinates.map(c => `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`).join('|');
    
    if (useCache && osrmCache.current.has(cacheKey)) {
      return osrmCache.current.get(cacheKey);
    }

    try {
      setIsProcessingOSRM(true);

      // Sample if too many points
      let toSend = coordinates;
      if (coordinates.length > MAX_OSRM_POINTS) {
        const step = Math.ceil(coordinates.length / MAX_OSRM_POINTS);
        const sampled = coordinates.filter((_, i) => i % step === 0);
        if (sampled[sampled.length - 1] !== coordinates[coordinates.length - 1]) {
          sampled.push(coordinates[coordinates.length - 1]);
        }
        toSend = sampled;
      }

      // Build OSRM request
      const coordStr = toSend.map(p => `${p.longitude},${p.latitude}`).join(";");
      const timestamps = sanitizeTimestamps(toSend.map((_, i) => Date.now() / 1000 + i));
      const radiuses = new Array(toSend.length).fill(10);

      const url = `https://router.project-osrm.org/match/v1/driving/${coordStr}` +
        `?geometries=geojson&overview=full&gaps=ignore&tidy=true` +
        `&timestamps=${timestamps.join(";")}` +
        `&radiuses=${radiuses.join(";")}`;

      const response = await axios.get(url, { timeout: 10000 });
      const data = response.data;

      if (!data || !data.matchings || data.matchings.length === 0) {
        // Fallback to original coordinates
        const result = { 
          matchedRoute: coordinates.map(c => [c.latitude, c.longitude]), 
          confidence: 0.5,
          segments: []
        };
        osrmCache.current.set(cacheKey, result);
        return result;
      }

      // Find best matching
      let bestMatchIndex = 0;
      for (let i = 0; i < data.matchings.length; i++) {
        if ((data.matchings[i].confidence ?? 0) > (data.matchings[bestMatchIndex]?.confidence ?? -1)) {
          bestMatchIndex = i;
        }
      }

      const bestMatching = data.matchings[bestMatchIndex];
      const snappedPolyline = bestMatching.geometry.coordinates.map(([lon, lat]) => [lat, lon]);

      const result = {
        matchedRoute: snappedPolyline,
        confidence: bestMatching.confidence ?? 0.5,
        distance: bestMatching.distance ?? null,
        segments: [{
          positions: snappedPolyline,
          confidence: bestMatching.confidence ?? 0.5
        }]
      };

      osrmCache.current.set(cacheKey, result);
      return result;

    } catch (error) {
      console.warn('OSRM matching failed, using raw coordinates:', error.message);
      const result = { 
        matchedRoute: coordinates.map(c => [c.latitude, c.longitude]), 
        confidence: 0.3,
        segments: []
      };
      osrmCache.current.set(cacheKey, result);
      return result;
    } finally {
      setIsProcessingOSRM(false);
    }
  };

  // Process route coordinates with OSRM
  useEffect(() => {
    const processRoute = async () => {
      if (!routeCoordinates.length) return;

      const validCoords = routeCoordinates.filter(validateCoordinate);
      if (validCoords.length < 2) {
        setMatchedRoute(validCoords.map(c => [c.latitude, c.longitude]));
        setConfidenceSegments([]);
        return;
      }

      const result = await matchCoordinatesToRoads(validCoords);
      setMatchedRoute(result.matchedRoute);
      setConfidenceSegments(result.segments || []);
    };

    processRoute();
  }, [routeCoordinates]);

  // Generate HTML with Leaflet and OSRM-matched routes
  const generateMapHTML = () => {
    if (!matchedRoute.length && !currentLocation) {
      return `<html><body><div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial;">Loading map...</div></body></html>`;
    }

    const displayRoute = matchedRoute.length > 0 ? matchedRoute : [[currentLocation.latitude, currentLocation.longitude]];
    const startPoint = displayRoute[0];
    const currentPoint = displayRoute[displayRoute.length - 1];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
          #fallbackMap {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(45deg, #4CAF50, #2196F3);
            display: none; flex-direction: column;
            justify-content: center; align-items: center;
            color: white; font-family: Arial, sans-serif;
            text-align: center; padding: 20px;
          }
          .osrm-status {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="osrm-status" id="osrmStatus">Road-matched</div>
        <div id="fallbackMap">
          <h2>📍 Location Tracking Active</h2>
          <div style="margin: 20px 0;">
            <div>📍 Start: ${startPoint[0].toFixed(6)}, ${startPoint[1].toFixed(6)}</div>
            <div>📍 Current: ${currentPoint[0].toFixed(6)}, ${currentPoint[1].toFixed(6)}</div>
            <div>🛣️ Points tracked: ${displayRoute.length}</div>
          </div>
          <div style="font-size: 14px; opacity: 0.8;">Map visualization temporarily unavailable</div>
        </div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          let map, polyline, startMarker, currentMarker, imageMarkers = [];
          let isMapInitialized = false;

          function initMap() {
            try {
              const routePoints = ${JSON.stringify(displayRoute)};
              const imageMarkersData = ${JSON.stringify(imageMarkers || [])};
              const confidenceSegments = ${JSON.stringify(confidenceSegments)};
              
              if (!routePoints.length) return;

              map = L.map('map', {
                zoomControl: true,
                attributionControl: true,
                preferCanvas: true
              });

              // Add tile layer with offline fallback
              const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors',
                errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
              });

              tileLayer.on('tileerror', function(error) {
                console.warn('Tile loading error:', error);
              });

              tileLayer.addTo(map);

              // Draw confidence segments if available
              if (confidenceSegments.length > 0) {
                confidenceSegments.forEach(segment => {
                  const color = getConfidenceColor(segment.confidence);
                  L.polyline(segment.positions, { 
                    color: color, 
                    weight: 6, 
                    opacity: 0.9,
                    smoothFactor: 1.0
                  }).addTo(map);
                });
              } else {
                // Draw main route
                polyline = L.polyline(routePoints, { 
                  color: '#0066FF', 
                  weight: 4,
                  smoothFactor: 1.0
                }).addTo(map);
              }

              // Fit bounds
              if (routePoints.length > 1) {
                const bounds = L.latLngBounds(routePoints);
                map.fitBounds(bounds, { padding: [40, 40] });
              } else {
                map.setView(routePoints[0], 16);
              }

              // Add markers
              if (routePoints.length > 0) {
                startMarker = L.circleMarker(routePoints[0], {
                  radius: 7, fillColor: '#2ecc71', color: '#fff', weight: 2, fillOpacity: 1
                }).addTo(map).bindPopup("Trip Start");

                if (routePoints.length > 1) {
                  currentMarker = L.circleMarker(routePoints[routePoints.length - 1], {
                    radius: 7, fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1
                  }).addTo(map).bindPopup("Current Location");
                }
              }

              // Add image markers
              addImageMarkers(imageMarkersData);

              isMapInitialized = true;
              window.ReactNativeWebView.postMessage("mapReady");
            } catch (err) {
              console.error('Map initialization error:', err);
              document.getElementById('map').style.display = 'none';
              document.getElementById('fallbackMap').style.display = 'flex';
              window.ReactNativeWebView.postMessage("fallbackShown:" + err.message);
            }
          }

          function getConfidenceColor(confidence) {
            if (confidence >= 0.8) return "#16a34a"; // strong green
            if (confidence >= 0.5) return "#f59e0b"; // amber
            return "#ef4444"; // weak red
          }

          function addImageMarkers(markersData) {
            if (!isMapInitialized) return;
            
            imageMarkers.forEach(marker => {
              if (map.hasLayer(marker)) {
                map.removeLayer(marker);
              }
            });
            imageMarkers = [];

            markersData.forEach((markerData, index) => {
              if (markerData.location && markerData.location.latitude && markerData.location.longitude) {
                const icon = getMarkerIcon(markerData.type);
                const marker = L.circleMarker([markerData.location.latitude, markerData.location.longitude], {
                  radius: 10,
                  fillColor: getMarkerColor(markerData.type),
                  color: '#fff',
                  weight: 2,
                  fillOpacity: 0.9
                }).addTo(map);

                const popupContent = \`
                  <div style="text-align: center; min-width: 150px;">
                    <div style="font-size: 20px; margin-bottom: 5px;">\${icon}</div>
                    <div style="font-weight: bold; margin-bottom: 5px;">\${getMarkerTitle(markerData.type)}</div>
                    \${markerData.description ? \`<div style="font-size: 12px; color: #666; margin-bottom: 8px;">\${markerData.description}</div>\` : ''}
                    <div style="font-size: 11px; color: #999;">\${formatDateTime(markerData.timestampIST)}</div>
                    <button onclick="viewImage(\${index})" style="
                      background: #007AFF; 
                      color: white; 
                      border: none; 
                      padding: 6px 12px; 
                      border-radius: 4px; 
                      margin-top: 8px;
                      cursor: pointer;
                      font-size: 12px;
                    ">View Image</button>
                  </div>
                \`;

                marker.bindPopup(popupContent);
                imageMarkers.push(marker);
              }
            });
          }

          function getMarkerIcon(type) {
            switch(type) {
              case 'start_speedometer': return '🚗';
              case 'end_speedometer': return '🏁';
              case 'journey_stop': return '⛽';
              default: return '📸';
            }
          }

          function getMarkerColor(type) {
            switch(type) {
              case 'start_speedometer': return '#2ecc71';
              case 'end_speedometer': return '#e74c3c';
              case 'journey_stop': return '#f39c12';
              default: return '#9b59b6';
            }
          }

          function getMarkerTitle(type) {
            switch(type) {
              case 'start_speedometer': return 'Trip Start';
              case 'end_speedometer': return 'Trip End';
              case 'journey_stop': return 'Journey Stop';
              default: return 'Image';
            }
          }

          function formatDateTime(timestamp) {
            try {
              const date = new Date(timestamp);
              return date.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
            } catch (error) {
              return timestamp;
            }
          }

          function viewImage(index) {
            window.ReactNativeWebView.postMessage("imageMarkerPressed:" + index);
          }

          // Update route with new OSRM-matched data
          window.updateRoute = function(newRouteData) {
            if (!isMapInitialized) return;
            
            try {
              const data = JSON.parse(newRouteData);
              const routePoints = data.matchedRoute || data.route || [];
              const segments = data.segments || [];
              
              if (!routePoints.length) return;

              // Clear existing route
              map.eachLayer(layer => {
                if (layer instanceof L.Polyline && !(layer instanceof L.CircleMarker)) {
                  map.removeLayer(layer);
                }
              });

              // Draw new segments or route
              if (segments.length > 0) {
                segments.forEach(segment => {
                  const color = getConfidenceColor(segment.confidence);
                  L.polyline(segment.positions, { 
                    color: color, 
                    weight: 6, 
                    opacity: 0.9,
                    smoothFactor: 1.0
                  }).addTo(map);
                });
              } else {
                L.polyline(routePoints, { 
                  color: '#0066FF', 
                  weight: 4,
                  smoothFactor: 1.0
                }).addTo(map);
              }

              // Update current marker
              if (currentMarker && map.hasLayer(currentMarker)) {
                map.removeLayer(currentMarker);
              }
              
              const currentPoint = routePoints[routePoints.length - 1];
              currentMarker = L.circleMarker(currentPoint, {
                radius: 7, fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1
              }).addTo(map).bindPopup("Current Location");

              map.panTo(currentPoint, { animate: true, duration: 0.5 });
              window.ReactNativeWebView.postMessage("routeUpdated:" + routePoints.length);
            } catch (err) {
              window.ReactNativeWebView.postMessage("error:" + err.message);
            }
          };

          // Update image markers
          window.updateImageMarkers = function(newImageMarkers) {
            try {
              const markersData = JSON.parse(newImageMarkers);
              addImageMarkers(markersData);
              window.ReactNativeWebView.postMessage("imageMarkersUpdated:" + markersData.length);
            } catch (err) {
              window.ReactNativeWebView.postMessage("error:" + err.message);
            }
          };

          // Initialize map when ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMap);
          } else {
            initMap();
          }
        </script>
      </body>
      </html>
    `;
  };

  // Send OSRM-matched route updates to WebView
  useEffect(() => {
    if (mapReady && matchedRoute.length > 0 && webViewRef.current) {
      const routeData = {
        matchedRoute: matchedRoute,
        segments: confidenceSegments,
        confidence: confidenceSegments.length > 0 ? confidenceSegments[0].confidence : 1
      };
      
      webViewRef.current.postMessage(`updateRoute:${JSON.stringify(routeData)}`);
    }
  }, [matchedRoute, confidenceSegments, mapReady]);

  // Image marker updates
  useEffect(() => {
    if (mapReady && webViewRef.current) {
      const currentLength = imageMarkers.length;
      const lastLength = lastImageMarkersLength.current;
      
      if (currentLength !== lastLength) {
        const imageMarkersString = JSON.stringify(imageMarkers);
        webViewRef.current.postMessage(`updateImageMarkers:${imageMarkersString}`);
        lastImageMarkersLength.current = currentLength;
      }
    }
  }, [imageMarkers, mapReady]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <BlinkingCircle isTracking={isTracking} />
          <Text style={styles.title}>
            Live Tracking {isProcessingOSRM && '(Processing...)'}
          </Text>
        </View>
        <Text style={styles.coordinates}>
          {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
        </Text>
        <Text style={styles.pointCount}>
          {routeCoordinates.length} point{routeCoordinates.length !== 1 ? "s" : ""} tracked
          {confidenceSegments.length > 0 && ` • ${(confidenceSegments[0].confidence * 100).toFixed(0)}% confidence`}
        </Text>
      </View>

      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: generateMapHTML() }}
        onLoad={() => setTimeout(() => setMapReady(true), 800)}
        onMessage={(event) => {
          const data = event.nativeEvent.data;
          if (data === "mapReady") setMapReady(true);
          if (data.startsWith("error:")) console.error("Map error:", data);
          if (data.startsWith("fallbackShown:")) console.warn("Map fallback shown:", data);
          if (data.startsWith("imageMarkerPressed:")) {
            const index = parseInt(data.split(":")[1]);
            if (onImageMarkerPress && imageMarkers[index]) {
              onImageMarkerPress(imageMarkers[index]);
            }
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        cacheEnabled={true}
        incognito={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", borderRadius: 10, overflow: "hidden", elevation: 5 },
  header: { backgroundColor: "#007AFF", paddingHorizontal: 15, paddingVertical: 8, alignItems: "center" },
  title: { color: "#fff", fontSize: 14, fontWeight: "bold", marginBottom: 3 },
  coordinates: { color: "#fff", fontSize: 11, fontFamily: "monospace", marginBottom: 2 },
  pointCount: { color: "#fff", fontSize: 10, opacity: 0.9 },
  map: { flex: 1, backgroundColor: "#f0f0f0" },
  headerTitleContainer: { flexDirection: "row", alignItems: "center", marginBottom: 5, paddingBottom: 2 }
});

export default MapWebViewWithOSRM;
