import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import BackgroundActions from 'react-native-background-actions';
import Location from 'react-native-location';
import NetInfo from '@react-native-community/netinfo';
import * as Keychain from 'react-native-keychain';
import { openRealm, writeLocation, getLocations, deleteAllLocations } from '../db/realm';
import { storeRoute } from '../api/routes';

const sleep = (time) => new Promise((resolve) => setTimeout(() => resolve(), time));

const HomeScreen = ({ navigation }) => {
  const [isTracking, setIsTracking] = useState(BackgroundActions.isRunning);

  const syncOfflineData = async () => {
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      const locations = await getLocations();
      if (locations.length > 0) {
        try {
          const route = locations.map(loc => ({ latitude: loc.latitude, longitude: loc.longitude, timestamp: loc.timestamp }));
          await storeRoute(route);
          await deleteAllLocations();
          console.log('Offline data synced');
        } catch (error) {
          console.error('Failed to sync offline data', error);
        }
      }
    }
  };

  const backgroundTask = async (taskData) => {
    await new Promise(async (resolve) => {
      const { delay } = taskData;
      for (let i = 0; BackgroundActions.isRunning; i++) {
        try {
          const location = await Location.getLatestLocation({ timeout: 10000 });
          if (location) {
            console.log('Location fetched:', location);
            await writeLocation(location.latitude, location.longitude, new Date(location.timestamp));
            await syncOfflineData();
          }
        } catch (error) {
          console.error('Error fetching location:', error);
        }
        await sleep(delay);
      }
    });
  };

  useEffect(() => {
    const configureLocation = async () => {
      await openRealm();
      const permission = await Location.requestPermission({
        ios: 'whenInUse',
        android: {
          detail: 'fine',
          rationale: {
            title: 'Location permission',
            message: 'We need your location to track your route.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          },
        },
      });

      if (permission) {
        await Location.configure({
          distanceFilter: 10, // meters
          interval: 15000, // milliseconds
          android: {
            interval: 15000,
          }
        });
      }
    };

    configureLocation();

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
    const options = {
      taskName: 'LocationTracking',
      taskTitle: 'Tracking your location',
      taskDesc: 'Actively tracking your route.',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#ff00ff',
      linkingURI: 'your-app://homescreen',
      parameters: {
        delay: 15000, // 15 seconds
      },
    };

    try {
      await BackgroundActions.start(backgroundTask, options);
      setIsTracking(true);
      Alert.alert('Tracking Started', 'Location tracking has been enabled.');
    } catch (e) {
      console.warn('Error starting background task', e);
    }
  };

  const handleCheckOut = async () => {
    try {
      await BackgroundActions.stop();
      setIsTracking(false);
      await syncOfflineData();
      Alert.alert('Tracking Stopped', 'Location tracking has been disabled.');
    } catch (e) {
      console.warn('Error stopping background task', e);
    }
  };

  const handleLogout = async () => {
    if (isTracking) {
      await handleCheckOut();
    }
    await Keychain.resetGenericPassword();
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <View style={styles.buttonContainer}>
        <Button title="Check-in" onPress={handleCheckIn} disabled={isTracking} />
        <Button title="Check-out" onPress={handleCheckOut} disabled={!isTracking} />
      </View>
      <View style={styles.logoutButton}>
        <Button title="Logout" onPress={handleLogout} color="#f44336" />
      </View>
    </View>
  );
};

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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '60%',
  },
});

export default HomeScreen;
