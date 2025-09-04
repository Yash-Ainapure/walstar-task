import axios from 'axios';
import API_BASE_URL from './config';
import api from './api';

const API_URL = `${API_BASE_URL}/auth`;

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
    console.log('--- LOGIN ---');
    console.log('Logging in with:', { username, password });
    return await axios.post(`${API_URL}/login`, { username, password });
  } catch (error) {
    handleAuthError(error);
  }
};

// Fetches the profile of the currently logged-in user
export const getMyProfile = async () => {
  try {
    return await api.get('/auth/me'); 
  } catch (error) {
    // handleAuthError(error);
    console.error("Failed to fetch profile:", error);
    throw error;
  }
};


// Updates the profile of the currently logged-in user
export const updateMyProfile = async (profileData) => {
  try {
    return await api.put('/auth/me', profileData);
  } catch (error) {
    // handleAuthError(error);
    console.error("Failed to update profile:", error);
    throw error;
  }
};

// ✅ NEW FUNCTION FOR PHOTO UPLOAD
// export const updateMyPhoto = async (photo) => {
//   try {
//     // Create a new FormData object
//     const formData = new FormData();

//     // Extract file name and type from the local URI
//     const uriParts = photo.uri.split('.');
//     const fileType = uriParts[uriParts.length - 1];

//     // Append the file to the FormData object
//     // The key 'profileImage' MUST match what your backend's upload middleware expects
//     formData.append('profileImage', {
//       uri: photo.uri,
//       name: `photo.${fileType}`,
//       type: `image/${fileType}`,
//     });

//     // Make the PUT request with the FormData
//     // We also need to specify the 'Content-Type' header
//     const response = await api.put('/auth/me/photo', formData, {
//       headers: {
//         'Content-Type': 'multipart/form-data',
//       },
//     });

//     return response;
//   } catch (error) {
//     console.error('Failed to update photo:', error);
//     throw error;
//   }
// };

export const updateMyPhotoBase64 = async (base64String) => {
  try {
    // We send a simple JSON object
    const response = await api.put('/auth/me/photobase64', { photo: base64String });
    return response;
  } catch (error) {
    console.error('Failed to update photo with Base64:', error);
    throw error;
  }
};
