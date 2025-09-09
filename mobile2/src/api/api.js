// src/api/api.js

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

import API_BASE_URL from './config';

const api = axios.create({
  baseURL: API_BASE_URL+'/api',
});

// Store reference to logout function - will be set by AuthContext
let logoutFunction = null;

export const setLogoutFunction = (logout) => {
  logoutFunction = logout;
};

// This is the interceptor. It runs before every request.
api.interceptors.request.use(
  async (config) => {
    // Get the token from secure storage
    const token = await SecureStore.getItemAsync('userToken');

    if (token) {
      // If the token exists, add it to the Authorization header
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle session expiry
api.interceptors.response.use(
  (response) => {
    // If the response is successful, just return it
    return response;
  },
  async (error) => {
    // Check if the error is due to unauthorized access (401)
    if (error.response && error.response.status === 401) {
      // Show session expired message
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please login again.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Call logout function if available
              if (logoutFunction) {
                logoutFunction();
              }
            }
          }
        ]
      );
    }
    
    return Promise.reject(error);
  }
);

export default api;