import axios from 'axios';

const API_URL = 'http://192.168.1.20:5001/api/auth'; // Replace with your backend URL

const handleAuthError = (error) => {
  if (error.response) {
    console.error('Error response data:', error.response.data);
    console.error('Error response status:', error.response.status);
  } else if (error.request) {
    console.error('Error request:', error.request);
  } else {
    console.error('Error message:', error.message);
  }
  console.error('Axios config:', error.config);
  throw error;
};

export const register = async (username, password) => {
  try {
    return await axios.post(`${API_URL}/register`, { username, password });
  } catch (error) {
    handleAuthError(error);
  }
};

export const login = async (username, password) => {
  try {
    return await axios.post(`${API_URL}/login`, { username, password });
  } catch (error) {
    handleAuthError(error);
  }
};
