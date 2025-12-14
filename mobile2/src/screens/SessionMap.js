// SessionMapWebView.js
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Modal, Image, TouchableOpacity, Dimensions } from "react-native";
import { WebView } from "react-native-webview";
import axios from "axios";

const MAX_OSRM_POINTS = 100;

// ===== Helpers =====
function sanitizeTimestamps(raw) {
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
}

function confidenceColor(c) {
  if (c >= 0.8) return "#16a34a"; // strong green
  if (c >= 0.5) return "#f59e0b"; // amber
  return "#ef4444"; // weak red
}

const SessionMapWebView = ({ route }) => {
  const { session } = route?.params ?? {};
  const [loading, setLoading] = useState(true);
  const [mergedPolyline, setMergedPolyline] = useState([]);
  const [confidenceSegments, setConfidenceSegments] = useState([]);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // Log session data on component mount
  useEffect(() => {
    console.log('📊 SessionMap - Route params received:', {
      hasSession: !!session,
      sessionId: session?.sessionId,
      sessionName: session?.name,
      locationsCount: session?.locations?.length || 0,
      imagesCount: session?.images?.length || 0,
      hasImages: !!(session?.images && session.images.length > 0)
    });

    if (session?.images && session.images.length > 0) {
      console.log('🖼️ SessionMap - Images found in session:');
      session.images.forEach((image, index) => {
        console.log(`  Image ${index + 1}:`, {
          type: image.type,
          hasLocation: !!(image.location && image.location.latitude && image.location.longitude),
          location: image.location ? `${image.location.latitude.toFixed(6)}, ${image.location.longitude.toFixed(6)}` : 'No location',
          timestamp: image.timestampIST,
          description: image.description || 'No description',
          url: image.url ? 'Has URL' : 'No URL'
        });
      });

      // Count images by type
      const imageTypes = session.images.reduce((acc, img) => {
        acc[img.type] = (acc[img.type] || 0) + 1;
        return acc;
      }, {});
      console.log('📈 SessionMap - Image types breakdown:', imageTypes);

      // Count images with valid locations
      const imagesWithLocation = session.images.filter(img => 
        img.location && img.location.latitude && img.location.longitude
      ).length;
      console.log(`📍 SessionMap - Images with valid locations: ${imagesWithLocation}/${session.images.length}`);
    } else {
      console.log('❌ SessionMap - No images found in session data');
    }
  }, [session]);

  useEffect(() => {
    if (!session?.locations?.length) {
      setLoading(false);
      return;
    }

    const fetchMatched = async () => {
      try {
        const valid = session.locations.filter(
          (l) =>
            l &&
            typeof l.latitude === "number" &&
            typeof l.longitude === "number" &&
            !Number.isNaN(l.latitude) &&
            !Number.isNaN(l.longitude)
        );

        if (valid.length < 2) {
          setMergedPolyline(valid.map((p) => [p.latitude, p.longitude]));
          setConfidenceSegments([]);
          setDistanceMeters(0);
          setLoading(false);
          return;
        }

        // sample if too many
        let toSend = valid;
        if (valid.length > MAX_OSRM_POINTS) {
          const step = Math.ceil(valid.length / MAX_OSRM_POINTS);
          const sampled = valid.filter((_, i) => i % step === 0);
          if (sampled[sampled.length - 1] !== valid[valid.length - 1]) {
            sampled.push(valid[valid.length - 1]);
          }
          toSend = sampled;
        }

        // coords
        const coordStr = toSend.map((p) => `${p.longitude},${p.latitude}`).join(";");

        // timestamps
        const rawTimestamps = toSend.map((l) =>
          Math.floor(new Date(l.timestampUTC).getTime() / 1000)
        );
        const timestamps = sanitizeTimestamps(rawTimestamps);

        // radiuses (default 10m each)
        const radiuses = new Array(toSend.length).fill(10);

        // OSRM request
        const url =
          `https://router.project-osrm.org/match/v1/driving/${coordStr}` +
          `?geometries=geojson&overview=full&gaps=ignore&tidy=true` +
          `&timestamps=${timestamps.join(";")}` +
          `&radiuses=${radiuses.join(";")}`;

        const res = await axios.get(url, { timeout: 20000 });
        const data = res.data;

        if (!data || !data.matchings || data.matchings.length === 0) {
          setMergedPolyline(toSend.map((p) => [p.latitude, p.longitude]));
          setConfidenceSegments([]);
          setDistanceMeters(null);
          setLoading(false);
          return;
        }

        // pick best matching
        let bestMatchIndex = 0;
        for (let i = 0; i < data.matchings.length; i++) {
          if (
            (data.matchings[i].confidence ?? 0) >
            (data.matchings[bestMatchIndex]?.confidence ?? -1)
          ) {
            bestMatchIndex = i;
          }
        }

        const bestMatching = data.matchings[bestMatchIndex];
        const snappedPolyline = bestMatching.geometry.coordinates.map(
          ([lon, lat]) => [lat, lon]
        );

        setMergedPolyline(snappedPolyline);
        setConfidenceSegments([
          { positions: snappedPolyline, confidence: bestMatching.confidence ?? 1 },
        ]);
        setDistanceMeters(bestMatching.distance ?? null);
      } catch (e) {
        console.error("OSRM error", e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMatched();
  }, [session]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e88e5" />
      </View>
    );
  }

  if (!mergedPolyline.length) {
    return (
      <View style={styles.center}>
        <Text>No valid route</Text>
      </View>
    );
  }

  // Handle image marker press
  const handleImageMarkerPress = (imageData) => {
    console.log('🖼️ SessionMap - handleImageMarkerPress called with:', {
      type: imageData?.type,
      hasUrl: !!imageData?.url,
      hasLocation: !!(imageData?.location && imageData.location.latitude && imageData.location.longitude),
      timestamp: imageData?.timestampIST
    });
    setSelectedImage(imageData);
    setImageModalVisible(true);
  };

  // Build Leaflet HTML
  const leafletHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
      <style>#map { position:absolute; top:0; bottom:0; right:0; left:0; }</style>
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

        const mergedPolyline = ${JSON.stringify(mergedPolyline)};
        const confidenceSegments = ${JSON.stringify(confidenceSegments)};
        const imageMarkers = ${JSON.stringify(session?.images || [])};
        
        console.log('WebView - Map data loaded:', {
          polylinePoints: mergedPolyline.length,
          confidenceSegments: confidenceSegments.length,
          imageMarkers: imageMarkers.length
        });
        
        if (mergedPolyline.length > 0) {
          const poly = L.polyline(mergedPolyline, { color: '#2B8CFF', weight: 4, opacity: 0.7 }).addTo(map);
          map.fitBounds(poly.getBounds(), { padding: [40, 40] });
        }

        confidenceSegments.forEach(seg => {
          const color = (seg.confidence >= 0.8) ? "#16a34a" : (seg.confidence >= 0.5) ? "#f59e0b" : "#ef4444";
          L.polyline(seg.positions, { color, weight: 6, opacity: 0.9 }).addTo(map);
        });

        // Start marker
        L.circleMarker(mergedPolyline[0], {
          radius: 7, fillColor: '#2ecc71', color: '#fff', weight: 2, fillOpacity: 1
        }).addTo(map).bindPopup("Trip Start");

        // End marker
        L.circleMarker(mergedPolyline[mergedPolyline.length-1], {
          radius: 7, fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1
        }).addTo(map).bindPopup("Trip End");

        // Helper functions for image markers
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

        // Add image markers
        console.log('WebView - Processing image markers:', imageMarkers.length);
        let validMarkersAdded = 0;
        imageMarkers.forEach((markerData, index) => {
          if (markerData.location && markerData.location.latitude && markerData.location.longitude) {
            console.log('WebView - Adding marker ' + (index + 1) + ':', {
              type: markerData.type,
              location: [markerData.location.latitude, markerData.location.longitude],
              hasDescription: !!markerData.description
            });
            const icon = getMarkerIcon(markerData.type);
            const marker = L.circleMarker([markerData.location.latitude, markerData.location.longitude], {
              radius: 10,
              fillColor: getMarkerColor(markerData.type),
              color: '#fff',
              weight: 2,
              fillOpacity: 0.9
            }).addTo(map);
            validMarkersAdded++;

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
          } else {
            console.log('WebView - Skipping marker ' + (index + 1) + ': invalid location', {
              type: markerData.type,
              hasLocation: !!markerData.location,
              latitude: markerData.location?.latitude,
              longitude: markerData.location?.longitude
            });
          }
        });
        console.log('WebView - Added ' + validMarkersAdded + '/' + imageMarkers.length + ' valid image markers to map');
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView 
        originWhitelist={["*"]} 
        source={{ html: leafletHtml }}
        onMessage={(event) => {
          const data = event.nativeEvent.data;
          console.log('📨 SessionMap - WebView message received:', data);
          if (data.startsWith("imageMarkerPressed:")) {
            const index = parseInt(data.split(":")[1]);
            console.log('🖼️ SessionMap - Image marker pressed:', {
              index,
              hasSession: !!session,
              hasImages: !!(session?.images),
              imagesLength: session?.images?.length || 0,
              validIndex: index >= 0 && index < (session?.images?.length || 0)
            });
            if (session?.images && session.images[index]) {
              console.log('✅ SessionMap - Opening image modal for:', {
                type: session.images[index].type,
                hasUrl: !!session.images[index].url,
                timestamp: session.images[index].timestampIST
              });
              handleImageMarkerPress(session.images[index]);
            } else {
              console.log('❌ SessionMap - Invalid image index or no images available');
            }
          }
        }}
      />
      <View style={styles.footer}>
        <Text>Points: {session.locations?.length || 0}</Text>
        <Text>
          Distance:{" "}
          {distanceMeters ? (distanceMeters / 1000).toFixed(2) + " km" : "calculating..."}
        </Text>
        <Text>Images: {session?.images?.length || 0}</Text>
      </View>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setImageModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            
            {selectedImage && (
              <>
                <Image 
                  source={{ uri: selectedImage.url }} 
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <View style={styles.imageInfo}>
                  <Text style={styles.imageTitle}>
                    {selectedImage.type === 'start_speedometer' ? '🚗 Trip Start' :
                     selectedImage.type === 'end_speedometer' ? '🏁 Trip End' :
                     selectedImage.type === 'journey_stop' ? '⛽ Journey Stop' : '📸 Image'}
                  </Text>
                  {selectedImage.description && (
                    <Text style={styles.imageDescription}>{selectedImage.description}</Text>
                  )}
                  <Text style={styles.imageTimestamp}>
                    {new Date(selectedImage.timestampIST).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                  {selectedImage.location && (
                    <Text style={styles.imageLocation}>
                      📍 {selectedImage.location.latitude.toFixed(6)}, {selectedImage.location.longitude.toFixed(6)}
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SessionMapWebView;

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  footer: {
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f9f9f9",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    height: height * 0.8,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 15,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalImage: {
    width: '100%',
    flex: 1,
    marginTop: 30,
    marginBottom: 20,
  },
  imageInfo: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  imageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  imageDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  imageTimestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  imageLocation: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },
});
