import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import API_BASE_URL from './config';

const API_URL = `${API_BASE_URL}/api/routes`;

export const uploadSessionImage = async (sessionId, imageData) => {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const formData = new FormData();
    
    // Add the image file
    formData.append('image', {
      uri: imageData.image.uri,
      type: 'image/jpeg',
      name: `${imageData.type}_${Date.now()}.jpg`,
    });

    // Add metadata
    formData.append('type', imageData.type);
    if (imageData.description) {
      formData.append('description', imageData.description);
    }
    if (imageData.location) {
      formData.append('latitude', imageData.location.latitude.toString());
      formData.append('longitude', imageData.location.longitude.toString());
    }

    console.log('--- IMAGE UPLOAD DEBUG ---');
    console.log('Session ID:', sessionId);
    console.log('Image type:', imageData.type);
    console.log('Has location:', !!imageData.location);

    const response = await axios.post(
      `${API_URL}/me/session/${sessionId}/image`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout for image uploads
      }
    );

    return response.data;
  } catch (error) {
    console.error('Image upload error:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    }
    throw error;
  }
};

export const getSessionImages = async (sessionId) => {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await axios.get(
      `${API_URL}/me/session/${sessionId}/images`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data.images || [];
  } catch (error) {
    console.error('Get session images error:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    }
    throw error;
  }
};
