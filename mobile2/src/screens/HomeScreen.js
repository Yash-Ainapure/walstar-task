// HomeScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions, SafeAreaView, StatusBar, TextInput, Modal } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
// FIX: Import AsyncStorage to persist session details across app restarts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDB, writeLocation, getLocations, deleteAllLocations } from '../db/database';
import { storeRoute, createSession } from '../api/routes';
import { uploadSessionImage, getSessionImages } from '../api/images';
import MapWebView from '../components/MapWebView';
import ImageCapture from '../components/ImageCapture';
import ImageViewer from '../components/ImageViewer';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task (no changes here)
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
      await initDB();
      for (const location of locations) {
        await writeLocation(location.coords.latitude, location.coords.longitude, new Date(location.timestamp));
      }
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
  const [showTripNameModal, setShowTripNameModal] = useState(false);
  const [tripName, setTripName] = useState('');
  const [currentTripName, setCurrentTripName] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showImageCapture, setShowImageCapture] = useState(false);
  const [imageCaptureType, setImageCaptureType] = useState('start_speedometer');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  // const [pendingStartImage, setPendingStartImage] = useState(null);
  const [sessionImages, setSessionImages] = useState([]);

  // FIX: Modified syncOfflineData to accept session details as parameters.
  // This makes the checkout process more reliable by not depending on component state
  // which might be stale during async operations.
  const syncOfflineData = async (tripNameForSync = null, sessionIdForSync = null) => {
    console.log('=== SYNC PROCESS STARTING ===');
    console.log('Trip Name Param:', tripNameForSync);
    console.log('Session ID Param:', sessionIdForSync);
    console.log('Session ID from State (fallback):', currentSessionId);

    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      const locations = await getLocations();
      if (locations.length > 0) {
        try {
          // FIX: Prioritize the session ID passed as a parameter. Fall back to state for other syncs (e.g., on network reconnect).
          const finalSessionId = sessionIdForSync || currentSessionId;
          const finalTripName = tripNameForSync || currentTripName;

          if (!finalSessionId) {
            console.warn("SYNC SKIPPED: No Session ID available for sync.");
            return;
          }

          const route = locations.map(loc => ({
            latitude: loc.latitude,
            longitude: loc.longitude,
            timestamp: loc.timestamp
          }));

          const syncData = {
            route,
            sessionId: finalSessionId,
            tripName: finalTripName
          };

          console.log('=== SYNC DATA BEING SENT ===');
          console.log(JSON.stringify(syncData, null, 2));

          await storeRoute(syncData);
          await deleteAllLocations();
          console.log('=== SYNC COMPLETED SUCCESSFULLY ===');

        } catch (error) {
          console.error('=== SYNC ERROR ===');
          console.error('Failed to sync offline data:', error);
        }
      } else {
        console.log('No locations to sync.');
      }
    } else {
      console.log('No internet connection - sync skipped.');
    }
  };

  useEffect(() => {
    const configureApp = async () => {
      try {
        await initDB();

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

        const isAlreadyTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        setIsTracking(isAlreadyTracking);

        if (isAlreadyTracking) {
          // FIX: Restore session details from AsyncStorage if the app was closed during tracking.
          const storedSessionId = await AsyncStorage.getItem('currentSessionId');
          const storedTripName = await AsyncStorage.getItem('currentTripName');

          if (storedSessionId) {
            console.log('Restoring session from storage:', { storedSessionId, storedTripName });
            setCurrentSessionId(storedSessionId);
            setCurrentTripName(storedTripName || '');
          }

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

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        // We pass nulls here so it uses the component's state, which should have been restored.
        syncOfflineData(null, null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCheckIn = () => {
    setTripName('');
    setShowTripNameModal(true);
  };

  const startLocationTracking = async (startImage = null) => {
    try {
      const sessionId = `sess-${Date.now().toString(36)}`;
      const startTime = new Date();
      const finalTripName = tripName.trim(); // Use the trimmed name

      console.log('--- CHECK-IN PROCESS ---');
      console.log(`Starting trip: '${finalTripName}' with Session ID: ${sessionId}`);

      // FIX: Persist session details to AsyncStorage immediately.
      await AsyncStorage.setItem('currentSessionId', sessionId);
      await AsyncStorage.setItem('currentTripName', finalTripName);

      // Set state
      setCurrentSessionId(sessionId);
      setCurrentTripName(finalTripName);
      setTrackingStartTime(startTime);

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const initialCoord = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(initialCoord);
      setRouteCoordinates([initialCoord]);
      setShowMap(true);

      // Create session in the backend
      try {
        const sessionData = {
          date: startTime.toISOString().split('T')[0],
          sessionId: sessionId,
          startTime: startTime.toISOString(),
          endTime: startTime.toISOString(),
          locations: [],
          name: finalTripName // Send the trimmed name
        };
        await createSession(sessionData);
        console.log('--- SESSION CREATED ON BACKEND ---');
      } catch (sessionError) {
        console.error('--- ERROR CREATING SESSION ---', sessionError);
        Alert.alert('Error', 'Could not create tracking session. Please try again.');
        // Clean up stored items if session creation fails
        await AsyncStorage.multiRemove(['currentSessionId', 'currentTripName']);
        return;
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 2000,
        distanceInterval: 1,
        deferredUpdatesInterval: 1000,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      setIsTracking(true);

      if (startImage) {
        try {
          console.log('Uploading start image for session:', sessionId);
          await uploadSessionImage(sessionId, startImage);
          await fetchSessionImages();
        } catch (error) {
          console.error('Error uploading start image:', error);
        }
      }

      console.log('--- TRACKING STARTED SUCCESSFULLY ---');

    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Error', 'Could not start location tracking.');
    }
  };

  const finalizeCheckout = async () => {
    try {
      console.log('--- CHECK-OUT PROCESS ---');

      // FIX: Capture the current session details into local variables before any async operations.
      const sessionIdToSync = currentSessionId;
      const tripNameToSync = currentTripName;

      console.log('Finalizing checkout for Session ID:', sessionIdToSync);

      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

      // FIX: Pass the captured session details directly to the sync function.
      await syncOfflineData(tripNameToSync, sessionIdToSync);

      // FIX: Clear the persisted session details from AsyncStorage.
      await AsyncStorage.multiRemove(['currentSessionId', 'currentTripName']);

      // Reset component state
      setIsTracking(false);
      setShowMap(false);
      setRouteCoordinates([]);
      setCurrentLocation(null);
      setTrackingStartTime(null);
      setCurrentTripName('');
      setCurrentSessionId(null);

      console.log('--- CHECK-OUT COMPLETE ---');

    } catch (error) {
      console.error('Error stopping location tracking:', error);
      Alert.alert('Error', 'Could not stop location tracking.');
    }
  };


  // --- NO CHANGES IN THE FOLLOWING FUNCTIONS ---

  const handleTripNameSubmit = () => {
    if (tripName.trim()) {
      setShowTripNameModal(false);
      setImageCaptureType('start_speedometer');
      setShowImageCapture(true);
    } else {
      Alert.alert('Trip Name Required', 'Please enter a name for your trip.');
    }
  };

  const handleImageCaptured = async (imageData) => {
    try {
      if (imageCaptureType === 'start_speedometer') {
        // setPendingStartImage(imageData);
        await startLocationTracking(imageData);
      } else if (imageCaptureType === 'end_speedometer') {
        if (currentSessionId) {
          await uploadSessionImage(currentSessionId, imageData);
        }
        await finalizeCheckout();
      } else if (imageCaptureType === 'journey_stop') {
        if (currentSessionId) {
          await uploadSessionImage(currentSessionId, imageData);
          await fetchSessionImages();
          Alert.alert('Stop Recorded', 'Journey stop image has been saved successfully.');
        }
      }
      setShowImageCapture(false);
    } catch (error) {
      console.error('Error handling captured image:', error);
      Alert.alert('Upload Failed', 'Failed to save image. Please try again.');
    }
  };

  const fetchSessionImages = async () => {
    if (currentSessionId) {
      try {
        const images = await getSessionImages(currentSessionId);
        setSessionImages(images);
      } catch (error) {
        console.error('Error fetching session images:', error);
      }
    }
  };

  const handleImageMarkerPress = (image) => {
    setSelectedImage(image);
    setShowImageViewer(true);
  };

  const handleCheckOut = () => {
    setImageCaptureType('end_speedometer');
    setShowImageCapture(true);
  };

  const handleJourneyStop = () => {
    if (isTracking) {
      setImageCaptureType('journey_stop');
      setShowImageCapture(true);
    } else {
      Alert.alert('Not Tracking', 'Please start tracking first to record journey stops.');
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
          const latest = coords[coords.length - 1];
          setCurrentLocation(latest);
        }
      }
    };
    const interval = setInterval(updateMapLocation, 2000);
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

  // --- JSX REMAINS THE SAME, NO CHANGES NEEDED BELOW ---

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
          <>
            {currentTripName && (
              <Text style={styles.tripNameText}>
                Trip: {currentTripName}
              </Text>
            )}
            <Text style={styles.durationText}>
              Duration: {formatDuration(trackingStartTime)}
            </Text>
          </>
        )}
      </View>

      {showMap && currentLocation ? (
        <View style={styles.mapContainer}>
          <MapWebView
            currentLocation={currentLocation}
            routeCoordinates={routeCoordinates}
            isVisible={showMap}
            isTracking={isTracking}
            imageMarkers={sessionImages}
            onImageMarkerPress={handleImageMarkerPress}
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

        {isTracking && (
          <TouchableOpacity style={[styles.secondaryButton, styles.stopButton]} onPress={handleJourneyStop}>
            <Text style={styles.secondaryButtonText}>⛽ Add Stop</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showTripNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTripNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Enter Trip Name</Text>
            <Text style={styles.modalSubtitle}>Give your trip a memorable name</Text>

            <TextInput
              style={styles.tripNameInput}
              placeholder="e.g., Morning Delivery Route"
              value={tripName}
              onChangeText={setTripName}
              autoFocus={true}
              maxLength={50}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowTripNameModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.startButton]}
                onPress={handleTripNameSubmit}
              >
                <Text style={styles.startButtonText}>Start Tracking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ImageCapture
        visible={showImageCapture}
        onClose={() => setShowImageCapture(false)}
        onImageCaptured={handleImageCaptured}
        type={imageCaptureType}
      />

      <ImageViewer
        visible={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        image={selectedImage}
      />
    </SafeAreaView>
  );
};

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
  tripNameText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
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
  },
  checkoutButton: {
    backgroundColor: '#dc3545',
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
    elevation: 0,
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
  stopButton: {
    backgroundColor: '#ff6b35',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: Dimensions.get('window').width - 40,
    maxWidth: 400,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  tripNameInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  startButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;