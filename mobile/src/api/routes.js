import axios from 'axios';
import * as Keychain from 'react-native-keychain';

const API_URL = 'http://192.168.1.102:5001/api/routes'; // Replace with your backend URL

export const storeRoute = async (route) => {
  try {
    const credentials = await Keychain.getGenericPassword();
    if (credentials) {
      const { token } = credentials;
      return axios.post(`${API_URL}/location`, { route }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } catch (error) {
    console.error('Failed to store route', error);
    throw error;
  }
};
