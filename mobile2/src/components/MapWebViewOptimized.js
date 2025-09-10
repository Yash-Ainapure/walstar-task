// MapWebViewOptimized.js - Optimized version with incremental updates and offline support
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
// import { Asset } from 'expo-asset';
import BlinkingCircle from "./BlinkingCircle";

const MapWebViewOptimized = ({ currentLocation, routeCoordinates, isVisible, isTracking, imageMarkers = [], onImageMarkerPress }) => {
  const [mapReady, setMapReady] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const webViewRef = useRef(null);
  const lastRouteLength = useRef(0);
  const lastImageMarkersLength = useRef(0);
  const [leafletAssets, setLeafletAssets] = useState({});

  if (!isVisible || !currentLocation) return null;

  // Initialize assets - use CDN with offline caching
  useEffect(() => {
    // Set assets to CDN URLs - WebView will cache these automatically
    setLeafletAssets({
      css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
      js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    });
    setAssetsLoaded(true);
    console.log("Assets initialized - WebView will handle caching");
  }, []);

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

  // Generate optimized HTML with local assets
  const generateMapHTML = () => {
    if (!assetsLoaded) {
      return `<html><body><div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial;">Loading map assets...</div></body></html>`;
    }

    const allPoints = routeCoordinates.length > 0 ? routeCoordinates : [currentLocation];
    const validPoints = allPoints.filter(validateCoordinate);

    if (validPoints.length === 0) {
      return `<html><body><div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial;">No valid location data</div></body></html>`;
    }

    const startPoint = validPoints[0];
    const currentPoint = validPoints[validPoints.length - 1];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="${leafletAssets.css}"/>
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
          .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div id="fallbackMap">
          <h2>📍 Location Tracking Active</h2>
          <div style="margin: 20px 0;">
            <div>📍 Start: ${startPoint.latitude.toFixed(6)}, ${startPoint.longitude.toFixed(6)}</div>
            <div>📍 Current: ${currentPoint.latitude.toFixed(6)}, ${currentPoint.longitude.toFixed(6)}</div>
            <div>🛣️ Points tracked: ${validPoints.length}</div>
          </div>
          <div style="font-size: 14px; opacity: 0.8;">Map visualization temporarily unavailable</div>
        </div>
        <script src="${leafletAssets.js}"></script>
        <script>
          let map, polyline, startMarker, currentMarker, imageMarkers = [];
          let isMapInitialized = false;

          function initMap() {
            try {
              const routePoints = ${JSON.stringify(validPoints.map(p => [p.latitude, p.longitude]))};
              const imageMarkersData = ${JSON.stringify(imageMarkers || [])};
              const startPoint = routePoints[0];
              const currentPoint = routePoints[routePoints.length - 1];

              // Initialize map with better error handling
              map = L.map('map', {
                zoomControl: true,
                attributionControl: true,
                preferCanvas: true // Better performance for many points
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

              // Create polyline with better performance
              if (routePoints.length > 0) {
                polyline = L.polyline(routePoints, { 
                  color: '#0066FF', 
                  weight: 4,
                  smoothFactor: 1.0 // Optimize for performance
                }).addTo(map);
                
                map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
              }

              // Add markers
              if (routePoints.length > 0) {
                startMarker = L.circleMarker(startPoint, {
                  radius: 7, fillColor: '#2ecc71', color: '#fff', weight: 2, fillOpacity: 1
                }).addTo(map).bindPopup("Trip Start");

                currentMarker = L.circleMarker(currentPoint, {
                  radius: 7, fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1
                }).addTo(map).bindPopup("Current Location");
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

          function addImageMarkers(markersData) {
            if (!isMapInitialized) return;
            
            // Clear existing image markers efficiently
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

          // Optimized incremental route update
          window.updateRouteIncremental = function(newPoints) {
            if (!isMapInitialized) return;
            
            try {
              const points = JSON.parse(newPoints);
              if (!points.length) return;

              const newLatLngs = points.map(p => [p.latitude, p.longitude]);
              
              if (polyline && map.hasLayer(polyline)) {
                // Efficiently append new points
                const existingLatLngs = polyline.getLatLngs();
                polyline.addLatLng(newLatLngs[newLatLngs.length - 1]); // Add only the latest point
                
                // Update bounds only if significant change
                if (newLatLngs.length > 5) {
                  map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
                }
              } else {
                // Create new polyline
                polyline = L.polyline(newLatLngs, { 
                  color: '#0066FF', 
                  weight: 4,
                  smoothFactor: 1.0
                }).addTo(map);
              }

              // Update current marker efficiently
              const currentPoint = newLatLngs[newLatLngs.length - 1];
              if (currentMarker && map.hasLayer(currentMarker)) {
                currentMarker.setLatLng(currentPoint);
              } else {
                currentMarker = L.circleMarker(currentPoint, {
                  radius: 7, fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1
                }).addTo(map).bindPopup("Current Location");
              }

              // Pan to new location smoothly
              map.panTo(currentPoint, { animate: true, duration: 0.5 });
              window.ReactNativeWebView.postMessage("routeUpdatedIncremental:" + newLatLngs.length);
            } catch (err) {
              window.ReactNativeWebView.postMessage("error:" + err.message);
            }
          };

          // Full route update (fallback)
          window.updateRoute = function(newRoutePoints) {
            if (!isMapInitialized) return;
            
            try {
              const points = JSON.parse(newRoutePoints).map(p => [p.latitude, p.longitude]);
              if (!points.length) return;

              // Remove existing polyline
              if (polyline && map.hasLayer(polyline)) {
                map.removeLayer(polyline);
              }
              
              // Create new polyline
              polyline = L.polyline(points, { 
                color: '#0066FF', 
                weight: 4,
                smoothFactor: 1.0
              }).addTo(map);

              // Update current marker
              if (currentMarker && map.hasLayer(currentMarker)) {
                map.removeLayer(currentMarker);
              }
              
              const currentPoint = points[points.length - 1];
              currentMarker = L.circleMarker(currentPoint, {
                radius: 7, fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1
              }).addTo(map).bindPopup("Current Location");

              map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
              window.ReactNativeWebView.postMessage("routeUpdated:" + points.length);
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

          // Initialize map when DOM is ready
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

  // Optimized incremental updates
  useEffect(() => {
    if (mapReady && routeCoordinates.length > 0 && webViewRef.current) {
      const currentLength = routeCoordinates.length;
      const lastLength = lastRouteLength.current;
      
      if (currentLength > lastLength) {
        // Send only new points for incremental update
        const newPoints = routeCoordinates.slice(lastLength);
        const newPointsString = JSON.stringify(newPoints);
        webViewRef.current.postMessage(`updateRouteIncremental:${newPointsString}`);
        lastRouteLength.current = currentLength;
      } else if (currentLength < lastLength) {
        // Route was reset, send full update
        const routePointsString = JSON.stringify(routeCoordinates);
        webViewRef.current.postMessage(`updateRoute:${routePointsString}`);
        lastRouteLength.current = currentLength;
      }
    }
  }, [routeCoordinates, mapReady]);

  // Optimized image marker updates
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
          <Text style={styles.title}>Live Tracking {!assetsLoaded && '(Loading...)'}</Text>
        </View>
        <Text style={styles.coordinates}>
          {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
        </Text>
        <Text style={styles.pointCount}>
          {routeCoordinates.length} point{routeCoordinates.length !== 1 ? "s" : ""} tracked
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

export default MapWebViewOptimized;
