import axios from 'axios';

const API_URL = 'http://192.168.1.102:5001/api/auth'; // Replace with your backend URL

export const register = (username, password) => {
  return axios.post(`${API_URL}/register`, { username, password });
};

export const login = (username, password) => {
  return axios.post(`${API_URL}/login`, { username, password });
};
