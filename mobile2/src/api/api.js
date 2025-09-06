// src/api/api.js

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import API_BASE_URL from './config';

const api = axios.create({
  baseURL: API_BASE_URL+'/api',
});

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

export default api;