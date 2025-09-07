// SessionMapWebView.js
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
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
        }).addTo(map);

        // End marker
        L.circleMarker(mergedPolyline[mergedPolyline.length-1], {
          radius: 7, fillColor: '#e74c3c', color: '#fff', weight: 2, fillOpacity: 1
        }).addTo(map);
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView originWhitelist={["*"]} source={{ html: leafletHtml }} />
      <View style={styles.footer}>
        <Text>Points: {session.locations?.length || 0}</Text>
        <Text>
          Distance:{" "}
          {distanceMeters ? (distanceMeters / 1000).toFixed(2) + " km" : "calculating..."}
        </Text>
      </View>
    </View>
  );
};

export default SessionMapWebView;

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
});
