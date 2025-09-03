import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const MapWebView = ({ currentLocation, routeCoordinates, isVisible }) => {
  const [mapReady, setMapReady] = useState(false);

  if (!isVisible || !currentLocation) {
    return null;
  }

  // Validate and sanitize coordinates
  const validateCoordinate = (coord) => {
    return coord && 
           typeof coord.latitude === 'number' && 
           typeof coord.longitude === 'number' &&
           !isNaN(coord.latitude) && 
           !isNaN(coord.longitude) &&
           coord.latitude >= -90 && coord.latitude <= 90 &&
           coord.longitude >= -180 && coord.longitude <= 180;
  };

  // Generate HTML for the map with dynamic route updates
  const generateMapHTML = () => {
    // Filter and validate all coordinates
    const allPoints = routeCoordinates.length > 0 ? routeCoordinates : [currentLocation];
    const validPoints = allPoints.filter(validateCoordinate);
    
    if (validPoints.length === 0) {
      console.warn('No valid coordinates found');
      return `<html><body><div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial;">No valid location data</div></body></html>`;
    }
    
    const routePoints = validPoints;
    const startPoint = routePoints[0];
    const currentPoint = routePoints[routePoints.length - 1];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; width: 100%; overflow: hidden; background: #f0f0f0; }
          #map { height: 100vh; width: 100vw; display: block; background: #e8e8e8; }
          #status { 
            position: absolute; 
            top: 10px; 
            left: 10px; 
            right: 10px;
            z-index: 1000;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            max-height: 200px;
            overflow-y: auto;
          }
          #fallbackMap {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, #4CAF50, #2196F3);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
          }
          .marker {
            position: absolute;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          .start-marker { background: #4CAF50; }
          .current-marker { background: #F44336; }
        </style>
      </head>
      <body>
        <div id="status">Initializing map...</div>
        <div id="map"></div>
        <div id="fallbackMap" style="display: none;">
          <h2>📍 Location Tracking Active</h2>
          <div style="margin: 20px 0;">
            <div style="margin: 10px 0;">📍 Start: ${startPoint.latitude.toFixed(6)}, ${startPoint.longitude.toFixed(6)}</div>
            <div style="margin: 10px 0;">📍 Current: ${currentPoint.latitude.toFixed(6)}, ${currentPoint.longitude.toFixed(6)}</div>
            <div style="margin: 10px 0;">🛣️ Points tracked: ${routePoints.length}</div>
          </div>
          <div style="font-size: 14px; opacity: 0.8;">Map visualization temporarily unavailable</div>
        </div>
        <script>
          let statusDiv = document.getElementById('status');
          let mapDiv = document.getElementById('map');
          let fallbackDiv = document.getElementById('fallbackMap');
          let map;
          let polyline;
          let startMarker;
          let currentMarker;
          let isMapReady = false;
          let initAttempts = 0;
          let maxAttempts = 3;
          
          function updateStatus(message) {
            console.log('MAP STATUS:', message);
            if (statusDiv) {
              statusDiv.innerHTML += '<br>' + new Date().toLocaleTimeString() + ': ' + message;
              statusDiv.scrollTop = statusDiv.scrollHeight;
            }
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('status:' + message);
          }
          
          function showFallback(reason) {
            updateStatus('Showing fallback map: ' + reason);
            if (mapDiv) mapDiv.style.display = 'none';
            if (fallbackDiv) fallbackDiv.style.display = 'flex';
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('fallbackShown:' + reason);
          }
          
          function testGoogleMapsAPI() {
            return new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyDaEOKRo298Oy7beBHpKpCf-L3y4ZHx69s';
              script.onload = () => {
                if (typeof google !== 'undefined' && google.maps) {
                  updateStatus('Google Maps API loaded successfully');
                  resolve(true);
                } else {
                  updateStatus('Google Maps API loaded but google.maps not available');
                  reject('API loaded but not accessible');
                }
              };
              script.onerror = () => {
                updateStatus('Failed to load Google Maps API script');
                reject('Script load failed');
              };
              document.head.appendChild(script);
            });
          }

          function initMap() {
            initAttempts++;
            updateStatus('Attempting to initialize map (attempt ' + initAttempts + ')');
            
            try {
              const routePoints = ${JSON.stringify(routePoints)};
              const startPoint = ${JSON.stringify(startPoint)};
              const currentPoint = ${JSON.stringify(currentPoint)};
              
              // Validate coordinates before using
              function isValidCoord(coord) {
                return coord && 
                       typeof coord.lat === 'number' && 
                       typeof coord.lng === 'number' &&
                       !isNaN(coord.lat) && 
                       !isNaN(coord.lng) &&
                       coord.lat >= -90 && coord.lat <= 90 &&
                       coord.lng >= -180 && coord.lng <= 180;
              }
              
              // Convert to Google Maps format and validate
              const validRoutePoints = routePoints.map(p => ({
                lat: parseFloat(p.latitude),
                lng: parseFloat(p.longitude)
              })).filter(isValidCoord);
              
              const validStartPoint = {
                lat: parseFloat(startPoint.latitude),
                lng: parseFloat(startPoint.longitude)
              };
              
              const validCurrentPoint = {
                lat: parseFloat(currentPoint.latitude),
                lng: parseFloat(currentPoint.longitude)
              };
              
              updateStatus('Validated points: ' + validRoutePoints.length + ' of ' + routePoints.length);
              
              if (!isValidCoord(validStartPoint)) {
                throw new Error('Invalid start point coordinates');
              }
              
              if (!isValidCoord(validCurrentPoint)) {
                throw new Error('Invalid current point coordinates');
              }
              
              updateStatus('Route data: ' + routePoints.length + ' points');
              updateStatus('Start: ' + startPoint.latitude + ', ' + startPoint.longitude);
              updateStatus('Current: ' + currentPoint.latitude + ', ' + currentPoint.longitude);
              
              if (typeof google === 'undefined' || !google.maps) {
                throw new Error('Google Maps API not available');
              }
              
              updateStatus('Creating Google Map instance...');
              map = new google.maps.Map(document.getElementById("map"), {
                zoom: 16,
                center: validCurrentPoint,
                mapTypeId: 'roadmap',
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                scaleControl: false,
                streetViewControl: false,
                rotateControl: false,
                fullscreenControl: false
              });

              // Wait for map to be ready
              google.maps.event.addListenerOnce(map, 'idle', function() {
                updateStatus('Map is ready and idle');
                isMapReady = true;
                if (statusDiv) statusDiv.style.display = 'none';
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage('mapReady');
              });
              
              google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
                updateStatus('Map tiles loaded successfully');
              });

              // Create polyline for the route
              if (validRoutePoints.length > 1) {
                updateStatus('Creating route polyline...');
                polyline = new google.maps.Polyline({
                  path: validRoutePoints,
                  geodesic: true,
                  strokeColor: '#0066FF',
                  strokeOpacity: 1.0,
                  strokeWeight: 4
                });
                polyline.setMap(map);
              }

              // Start marker (green)
              updateStatus('Creating start marker...');
              startMarker = new google.maps.Marker({
                position: validStartPoint,
                map: map,
                title: "Trip Start",
                icon: {
                  url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                }
              });

              // Current location marker (red) - only if different from start
              if (validRoutePoints.length > 1) {
                updateStatus('Creating current location marker...');
                currentMarker = new google.maps.Marker({
                  position: validCurrentPoint,
                  map: map,
                  title: "Current Location",
                  icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                  }
                });
              }

              // Fit map bounds to show entire route
              if (validRoutePoints.length > 1) {
                const bounds = new google.maps.LatLngBounds();
                validRoutePoints.forEach(point => bounds.extend(point));
                map.fitBounds(bounds);
                updateStatus('Map bounds fitted to route');
              } else {
                map.setCenter(validStartPoint);
                map.setZoom(16);
                updateStatus('Map centered on start point');
              }

              updateStatus('Map initialization completed successfully with ' + validRoutePoints.length + ' valid points');
              
              // Hide status after successful init
              setTimeout(() => {
                if (statusDiv && isMapReady) statusDiv.style.display = 'none';
              }, 3000);
              
            } catch (error) {
              updateStatus('Error initializing map: ' + error.message);
              if (initAttempts < maxAttempts) {
                updateStatus('Retrying in 2 seconds...');
                setTimeout(initMap, 2000);
              } else {
                showFallback('Failed after ' + maxAttempts + ' attempts: ' + error.message);
              }
            }
          }
          
          // Start initialization process
          updateStatus('Starting map initialization process...');
          
          // Check if Google Maps is already loaded
          if (typeof google !== 'undefined' && google.maps) {
            updateStatus('Google Maps API already available');
            initMap();
          } else {
            updateStatus('Loading Google Maps API...');
            testGoogleMapsAPI()
              .then(() => {
                setTimeout(initMap, 500);
              })
              .catch((error) => {
                updateStatus('API test failed: ' + error);
                showFallback('Google Maps API unavailable: ' + error);
              });
          }

          // Function to update route (called from React Native)
          window.updateRoute = function(newRoutePoints) {
            try {
              if (!map || !isMapReady) {
                updateStatus('Map not ready for updates');
                return;
              }
              
              const points = JSON.parse(newRoutePoints);
              
              // Validate and convert coordinates
              const validPoints = points.map(p => ({
                lat: parseFloat(p.latitude),
                lng: parseFloat(p.longitude)
              })).filter(p => 
                p && 
                typeof p.lat === 'number' && 
                typeof p.lng === 'number' &&
                !isNaN(p.lat) && 
                !isNaN(p.lng) &&
                p.lat >= -90 && p.lat <= 90 &&
                p.lng >= -180 && p.lng <= 180
              );
              
              updateStatus('Updating route with ' + validPoints.length + ' valid points (of ' + points.length + ' total)');
              
              if (validPoints.length === 0) {
                updateStatus('No valid points to update');
                return;
              }
              
              // Update polyline
              if (polyline) {
                polyline.setMap(null);
              }
              
              if (validPoints.length > 1) {
                polyline = new google.maps.Polyline({
                  path: validPoints,
                  geodesic: true,
                  strokeColor: '#0066FF',
                  strokeOpacity: 1.0,
                  strokeWeight: 4
                });
                polyline.setMap(map);
              }

              // Update current location marker
              if (currentMarker) {
                currentMarker.setMap(null);
              }
              
              if (validPoints.length > 1) {
                const currentPoint = validPoints[validPoints.length - 1];
                currentMarker = new google.maps.Marker({
                  position: currentPoint,
                  map: map,
                  title: "Current Location",
                  icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                  }
                });
                
                // Center map on current location
                map.panTo(currentPoint);
              }
              updateStatus('Route updated successfully');
            } catch (error) {
              updateStatus('Error updating route: ' + error.message);
            }
          };
          
          // Handle potential errors
          window.onerror = function(msg, url, lineNo, columnNo, error) {
            const errorMsg = 'JS Error: ' + msg + ' at ' + url + ':' + lineNo + ':' + columnNo;
            updateStatus(errorMsg);
            return false;
          };
        </script>
      </body>
      </html>
    `;
  };

  // Update route when coordinates change
  useEffect(() => {
    if (mapReady && routeCoordinates.length > 0) {
      const webViewRef = global.mapWebViewRef;
      if (webViewRef) {
        const routePointsString = JSON.stringify(routeCoordinates);
        webViewRef.postMessage(`updateRoute:${routePointsString}`);
      }
    }
  }, [routeCoordinates, mapReady]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📍 Live Tracking</Text>
        <Text style={styles.coordinates}>
          {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
        </Text>
        <Text style={styles.pointCount}>
          {routeCoordinates.length} point{routeCoordinates.length !== 1 ? 's' : ''} tracked
        </Text>
      </View>
      
      <WebView
        ref={(ref) => { global.mapWebViewRef = ref; }}
        style={styles.map}
        source={{ html: generateMapHTML() }}
        onLoad={() => {
          console.log('Map WebView loaded');
          setTimeout(() => setMapReady(true), 1000);
        }}
        onError={(error) => {
          console.error('WebView error:', error);
          console.error('Error details:', JSON.stringify(error));
        }}
        onMessage={(event) => {
          const data = event.nativeEvent.data;
          console.log('Message from WebView:', data);
          if (data === 'mapReady') {
            setMapReady(true);
          } else if (data.startsWith('status:')) {
            console.log('Map Status:', data.substring(7));
          } else if (data.startsWith('fallbackShown:')) {
            console.log('Fallback shown:', data.substring(14));
          } else if (data.startsWith('updateRoute:')) {
            const routeData = data.substring('updateRoute:'.length);
            // Handle any response from the web view if needed
          }
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('HTTP error:', nativeEvent);
        }}
        onRenderProcessGone={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('Render process gone:', nativeEvent);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  coordinates: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  pointCount: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.9,
  },
  map: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
});

export default MapWebView;
