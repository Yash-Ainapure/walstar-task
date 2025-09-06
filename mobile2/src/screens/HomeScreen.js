import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions, SafeAreaView, StatusBar } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import { initDB, writeLocation, getLocations, deleteAllLocations } from '../db/database';
import { storeRoute } from '../api/routes';
import MapWebView from '../components/MapWebView';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    console.log('--- BACKGROUND TASK ---');
    console.log(`Received ${locations.length} new locations in background.`);
    try {
      await initDB(); // Initialize DB for the background task
      for (const location of locations) {
        await writeLocation(location.coords.latitude, location.coords.longitude, new Date(location.timestamp));
      }
      // Just store locations locally, don't sync immediately
      console.log('--- BACKGROUND TASK ---');
      console.log('Locations stored locally. Will sync on check-out.');
    } catch (err) {
      console.error('Error processing background location:', err);
    }
  }
});

const HomeScreen = ({ navigation }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [trackingStartTime, setTrackingStartTime] = useState(null);

  // ✅ Sync offline data to the server when online
  const syncOfflineData = async () => {
    console.log('--- SYNC ---');
    console.log('Checking for offline data to sync...');
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      const locations = await getLocations();
      if (locations.length > 0) {
        try {
          const route = locations.map(loc => ({
            latitude: loc.latitude,
            longitude: loc.longitude,
            timestamp: loc.timestamp
          }));
          await storeRoute(route);
          await deleteAllLocations();
          console.log('--- SYNC ---');
          console.log(`Synced ${locations.length} locations.`);
          console.log('Offline data synced successfully.');
        } catch (error) {
          console.error('Failed to sync offline data', error);
        }
      }
    }
  };


  useEffect(() => {
    const configureApp = async () => {
      try {
        // ✅ Initialize database before anything else
        await initDB();

        // ✅ Request location permissions
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        if (foregroundStatus !== 'granted') {
          Alert.alert('Permission Denied', 'Foreground location permission is required.');
          return;
        }

        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          Alert.alert('Permission Denied', 'Background location permission is required for tracking.');
          return;
        }

        // Check if tracking is already running
        const isAlreadyTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        setIsTracking(isAlreadyTracking);

        // If already tracking, restore map state and get current locations
        if (isAlreadyTracking) {
          setShowMap(true);
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
      } catch (error) {
        console.error('Error during configuration:', error);
      }
    };

    configureApp();

    // ✅ Sync offline data whenever network becomes available
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        syncOfflineData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCheckIn = async () => {
    try {
      console.log('--- CHECK-IN ---');
      console.log('Starting location tracking...');

      // Get initial location for map
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const initialCoord = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(initialCoord);
      setRouteCoordinates([initialCoord]);
      setShowMap(true);
      setTrackingStartTime(new Date());

      // await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      //   accuracy: Location.Accuracy.Balanced,
      //   timeInterval: 15 * 1000, // 15 seconds
      //   distanceInterval: 10, // 10 meters
      //   deferredUpdatesInterval: 15 * 1000, // 15 seconds
      //   pausesUpdatesAutomatically: true,
      //   showsBackgroundLocationIndicator: true,
      // });

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 2000,
        distanceInterval: 1,
        deferredUpdatesInterval: 1000,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      setIsTracking(true);
      // Alert.alert('Tracking Started', 'Location tracking has been enabled.');
      console.log('--- CHECK-IN ---');
      console.log('Location tracking started successfully.');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Error', 'Could not start location tracking.');
    }
  };

  const handleCheckOut = async () => {
    try {
      console.log('--- CHECK-OUT ---');
      console.log('Stopping location tracking...');
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(false);
      setShowMap(false);
      setRouteCoordinates([]);
      setCurrentLocation(null);
      setTrackingStartTime(null);
      await syncOfflineData(); // Sync any remaining data
      // Alert.alert('Tracking Stopped', 'Location tracking has been disabled.');
      console.log('--- CHECK-OUT ---');
      console.log('Location tracking stopped.');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
      Alert.alert('Error', 'Could not stop location tracking.');
    }
  };

  const handleViewLocalData = async () => {
    const locations = await getLocations();
    if (locations.length === 0) {
      Alert.alert('Local Database', 'No locations are currently stored on the device.');
    } else {
      console.log('--- Local Locations ---', locations);
      Alert.alert('Local Database', `Found ${locations.length} locations stored locally. Check the console for details.`);
    }
  };

  // Update route coordinates when new locations are received
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
          // Update current location to the latest one
          const latest = coords[coords.length - 1];
          setCurrentLocation(latest);
        }
      }
    };

    const interval = setInterval(updateMapLocation, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, [isTracking, showMap]);

  const formatDuration = (startTime) => {
    if (!startTime) return '00:00:00';
    const now = new Date();
    const diff = now - startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      <View style={styles.header}>
        <Text style={styles.title}>WalStar Tracking</Text>
        <View style={[styles.statusContainer, { display: isTracking ? 'none' : 'block' }]}>
          <View style={[styles.statusDot, { backgroundColor: isTracking ? '' : '#dc3545' }]} />
          <Text style={styles.statusText}>
            {isTracking ? '' : 'Ready to Track'}
          </Text>
        </View>
        {isTracking && trackingStartTime && (
          <Text style={styles.durationText}>
            Duration: {formatDuration(trackingStartTime)}
          </Text>
        )}
      </View>

      {showMap && currentLocation ? (
        <View style={styles.mapContainer}>
          <MapWebView
            currentLocation={currentLocation}
            routeCoordinates={routeCoordinates}
            isVisible={showMap}
            isTracking={isTracking}
          />
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderIcon}>🗺️</Text>
          <Text style={styles.placeholderTitle}>Map View</Text>
          <Text style={styles.placeholderText}>
            {isTracking ? 'Getting location...' : 'Tap Check-in to start tracking and view your route on the map'}
          </Text>
        </View>
      )}

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, isTracking && styles.disabledButton]}
          onPress={handleCheckIn}
          disabled={isTracking}
        >
          <Text style={[styles.buttonText, isTracking && styles.disabledButtonText]}>
            🚀 Check In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.checkoutButton, !isTracking && styles.disabledButton]}
          onPress={handleCheckOut}
          disabled={!isTracking}
        >
          <Text style={[styles.buttonText, !isTracking && styles.disabledButtonText]}>
            🏁 Check Out
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.secondaryControls}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleViewLocalData}>
          <Text style={styles.secondaryButtonText}>📊 View Data</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
    marginTop: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#495057',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 14,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  mapContainer: {
    flex: 1,
    margin: 15,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
  },
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 15,
    gap: 15,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  checkoutButton: {
    backgroundColor: '#dc3545',
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButtonText: {
    color: '#adb5bd',
  },
  secondaryControls: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 20,
    gap: 15,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
  },
  logoutButtonText: {
    color: '#fff',
  },
});

export default HomeScreen;
