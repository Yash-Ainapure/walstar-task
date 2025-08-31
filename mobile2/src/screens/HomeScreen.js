import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, Dimensions, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { initDB, writeLocation, getLocations, deleteAllLocations } from '../db/database';
import { storeRoute } from '../api/routes';

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
      
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15 * 1000, // 15 seconds
        distanceInterval: 10, // 10 meters
        deferredUpdatesInterval: 15 * 1000, // 15 seconds
        pausesUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: true,
      });
      setIsTracking(true);
      Alert.alert('Tracking Started', 'Location tracking has been enabled.');
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
      await syncOfflineData(); // Sync any remaining data
      Alert.alert('Tracking Stopped', 'Location tracking has been disabled.');
      console.log('--- CHECK-OUT ---');
      console.log('Location tracking stopped.');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
      Alert.alert('Error', 'Could not stop location tracking.');
    }
  };

  const handleLogout = async () => {
    if (isTracking) {
      await handleCheckOut();
    }
    await SecureStore.deleteItemAsync('userToken');
    navigation.navigate('Login');
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      
      {showMap && currentLocation && (
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>📍 Live Tracking</Text>
            <Text style={styles.coordinates}>
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </Text>
          </View>
          
          <ScrollView style={styles.routeList} showsVerticalScrollIndicator={false}>
            <Text style={styles.routeTitle}>🛣️ Route Points ({routeCoordinates.length})</Text>
            {routeCoordinates.map((coord, index) => (
              <View key={index} style={styles.routePoint}>
                <View style={styles.pointIndicator}>
                  <Text style={styles.pointNumber}>{index + 1}</Text>
                </View>
                <View style={styles.pointDetails}>
                  <Text style={styles.pointCoords}>
                    {coord.latitude.toFixed(6)}, {coord.longitude.toFixed(6)}
                  </Text>
                  <Text style={styles.pointTime}>
                    {index === 0 ? 'Start' : index === routeCoordinates.length - 1 ? 'Current' : `Point ${index}`}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.mapFooter}>
            <Text style={styles.statusText}>
              {routeCoordinates.length > 1 
                ? `📏 ${routeCoordinates.length} points tracked` 
                : '🎯 Waiting for movement...'}
            </Text>
          </View>
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <Button title="Check-in" onPress={handleCheckIn} disabled={isTracking} />
        <Button title="Check-out" onPress={handleCheckOut} disabled={!isTracking} />
      </View>
      <View style={styles.debugButton}>
        <Button title="View Local Data" onPress={handleViewLocalData} />
      </View>
      <View style={styles.logoutButton}>
        <Button title="Logout" onPress={handleLogout} color="#f44336" />
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  mapContainer: {
    width: width * 0.9,
    height: height * 0.5,
    marginBottom: 20,
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
    backgroundColor: '#fff',
  },
  mapHeader: {
    backgroundColor: '#007AFF',
    padding: 15,
    alignItems: 'center',
  },
  mapTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  coordinates: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  routeList: {
    flex: 1,
    padding: 10,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pointIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pointNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pointDetails: {
    flex: 1,
  },
  pointCoords: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
  },
  pointTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  mapFooter: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '60%',
    marginBottom: 20,
  },
  debugButton: {
    marginBottom: 40,
  },
  logoutButton: {

  }
});

export default HomeScreen;
