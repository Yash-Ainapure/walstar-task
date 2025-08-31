import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import API_BASE_URL from './config';

const API_URL = `${API_BASE_URL}/routes`;

export const storeRoute = async (route) => {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      return axios.post(`${API_URL}/sync`, { route }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
    console.error('Axios config:', error.config);
    throw error;
  }
};
