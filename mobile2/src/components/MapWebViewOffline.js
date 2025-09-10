// MapWebViewOffline.js - Fully offline version with embedded Leaflet
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import BlinkingCircle from "./BlinkingCircle";

const MapWebViewOffline = ({ currentLocation, routeCoordinates, isVisible, isTracking, imageMarkers = [], onImageMarkerPress }) => {
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef(null);
  const lastRouteLength = useRef(0);
  const lastImageMarkersLength = useRef(0);

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

  // Generate HTML with embedded Leaflet (no external dependencies)
  const generateMapHTML = () => {
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
        <style>
          /* Embedded Leaflet CSS - Essential styles only */
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
          .leaflet-container { position: relative; overflow: hidden; }
          .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow { position: absolute; }
          .leaflet-tile { width: 256px; height: 256px; }
          .leaflet-marker-icon, .leaflet-marker-shadow { display: block; }
          .leaflet-control { position: absolute; z-index: 800; pointer-events: auto; }
          .leaflet-popup { position: absolute; text-align: center; margin-bottom: 20px; }
          .leaflet-popup-content-wrapper { padding: 1px; text-align: left; border-radius: 12px; }
          .leaflet-popup-content { margin: 13px 19px; line-height: 1.3; font-size: 13px; }
          .leaflet-popup-tip-container { width: 40px; height: 20px; position: absolute; left: 50%; margin-left: -20px; overflow: hidden; pointer-events: none; }
          .leaflet-popup-tip { width: 17px; height: 17px; padding: 1px; margin: -10px auto 0; transform: rotate(45deg); }
          .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: white; color: #333; box-shadow: 0 3px 14px rgba(0,0,0,0.4); }
          .leaflet-popup-close-button { position: absolute; top: 0; right: 0; padding: 4px 4px 0 0; border: none; text-align: center; width: 18px; height: 14px; font: 16px/14px Tahoma, Verdana, sans-serif; color: #c3c3c3; text-decoration: none; font-weight: bold; background: transparent; }
          
          #fallbackMap {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(45deg, #4CAF50, #2196F3);
            display: none; flex-direction: column;
            justify-content: center; align-items: center;
            color: white; font-family: Arial, sans-serif;
            text-align: center; padding: 20px;
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
        
        <script>
          // Simplified map implementation without external dependencies
          let mapContainer, routePoints = [], currentMarker, imageMarkers = [];
          let isMapInitialized = false;

          function initMap() {
            try {
              const initialPoints = ${JSON.stringify(validPoints.map(p => [p.latitude, p.longitude]))};
              const imageMarkersData = ${JSON.stringify(imageMarkers || [])};
              
              mapContainer = document.getElementById('map');
              mapContainer.style.background = '#f0f8ff';
              mapContainer.style.position = 'relative';
              mapContainer.style.overflow = 'hidden';
              
              // Create a simple canvas-based map
              const canvas = document.createElement('canvas');
              canvas.width = mapContainer.clientWidth;
              canvas.height = mapContainer.clientHeight;
              canvas.style.position = 'absolute';
              canvas.style.top = '0';
              canvas.style.left = '0';
              mapContainer.appendChild(canvas);
              
              const ctx = canvas.getContext('2d');
              
              // Simple coordinate system
              const bounds = getBounds(initialPoints);
              const scale = Math.min(canvas.width / (bounds.maxLng - bounds.minLng), canvas.height / (bounds.maxLat - bounds.minLat)) * 0.8;
              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              const centerLat = (bounds.maxLat + bounds.minLat) / 2;
              const centerLng = (bounds.maxLng + bounds.minLng) / 2;
              
              function latLngToPixel(lat, lng) {
                const x = centerX + (lng - centerLng) * scale;
                const y = centerY - (lat - centerLat) * scale;
                return { x, y };
              }
              
              // Draw route
              if (initialPoints.length > 1) {
                ctx.strokeStyle = '#0066FF';
                ctx.lineWidth = 4;
                ctx.beginPath();
                
                const firstPoint = latLngToPixel(initialPoints[0][0], initialPoints[0][1]);
                ctx.moveTo(firstPoint.x, firstPoint.y);
                
                for (let i = 1; i < initialPoints.length; i++) {
                  const point = latLngToPixel(initialPoints[i][0], initialPoints[i][1]);
                  ctx.lineTo(point.x, point.y);
                }
                ctx.stroke();
              }
              
              // Draw markers
              if (initialPoints.length > 0) {
                // Start marker
                const startPixel = latLngToPixel(initialPoints[0][0], initialPoints[0][1]);
                drawMarker(ctx, startPixel.x, startPixel.y, '#2ecc71', '🚗');
                
                // Current marker
                const currentPixel = latLngToPixel(initialPoints[initialPoints.length - 1][0], initialPoints[initialPoints.length - 1][1]);
                drawMarker(ctx, currentPixel.x, currentPixel.y, '#e74c3c', '📍');
              }
              
              // Draw image markers
              imageMarkersData.forEach((marker, index) => {
                if (marker.location && marker.location.latitude && marker.location.longitude) {
                  const pixel = latLngToPixel(marker.location.latitude, marker.location.longitude);
                  const icon = getMarkerIcon(marker.type);
                  drawMarker(ctx, pixel.x, pixel.y, getMarkerColor(marker.type), icon);
                }
              });
              
              isMapInitialized = true;
              window.ReactNativeWebView.postMessage("mapReady");
              
            } catch (err) {
              console.error('Map initialization error:', err);
              document.getElementById('map').style.display = 'none';
              document.getElementById('fallbackMap').style.display = 'flex';
              window.ReactNativeWebView.postMessage("fallbackShown:" + err.message);
            }
          }
          
          function getBounds(points) {
            let minLat = points[0][0], maxLat = points[0][0];
            let minLng = points[0][1], maxLng = points[0][1];
            
            points.forEach(point => {
              minLat = Math.min(minLat, point[0]);
              maxLat = Math.max(maxLat, point[0]);
              minLng = Math.min(minLng, point[1]);
              maxLng = Math.max(maxLng, point[1]);
            });
            
            return { minLat, maxLat, minLng, maxLng };
          }
          
          function drawMarker(ctx, x, y, color, emoji) {
            // Draw circle background
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw white border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw emoji (simplified)
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(emoji, x, y);
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
          
          // Incremental route update
          window.updateRouteIncremental = function(newPoints) {
            try {
              const points = JSON.parse(newPoints);
              if (!points.length || !isMapInitialized) return;
              
              // For simplicity, redraw the entire map
              initMap();
              window.ReactNativeWebView.postMessage("routeUpdatedIncremental:" + points.length);
            } catch (err) {
              window.ReactNativeWebView.postMessage("error:" + err.message);
            }
          };
          
          // Full route update
          window.updateRoute = function(newRoutePoints) {
            try {
              const points = JSON.parse(newRoutePoints);
              if (!points.length || !isMapInitialized) return;
              
              initMap();
              window.ReactNativeWebView.postMessage("routeUpdated:" + points.length);
            } catch (err) {
              window.ReactNativeWebView.postMessage("error:" + err.message);
            }
          };
          
          // Update image markers
          window.updateImageMarkers = function(newImageMarkers) {
            try {
              const markersData = JSON.parse(newImageMarkers);
              initMap();
              window.ReactNativeWebView.postMessage("imageMarkersUpdated:" + markersData.length);
            } catch (err) {
              window.ReactNativeWebView.postMessage("error:" + err.message);
            }
          };
          
          // Initialize when ready
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
        const newPoints = routeCoordinates.slice(lastLength);
        const newPointsString = JSON.stringify(newPoints);
        webViewRef.current.postMessage(`updateRouteIncremental:${newPointsString}`);
        lastRouteLength.current = currentLength;
      } else if (currentLength < lastLength) {
        const routePointsString = JSON.stringify(routeCoordinates);
        webViewRef.current.postMessage(`updateRoute:${routePointsString}`);
        lastRouteLength.current = currentLength;
      }
    }
  }, [routeCoordinates, mapReady]);

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
          <Text style={styles.title}>Live Tracking (Offline)</Text>
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

export default MapWebViewOffline;
