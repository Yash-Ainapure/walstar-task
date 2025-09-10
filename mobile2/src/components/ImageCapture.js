import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Dimensions,
  Image,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const ImageCapture = ({ 
  visible, 
  onClose, 
  onImageCaptured, 
  type = 'journey_stop',
  title = 'Capture Image',
  subtitle = 'Take a photo or select from gallery'
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cameraType, setCameraType] = useState('back');
  const cameraRef = useRef(null);

  const requestCameraPermission = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      return result?.granted || false;
    }
    return permission.granted;
  };

  const handleCameraPress = async () => {
    console.log('Camera button pressed');
    try {
      const hasPermission = await requestCameraPermission();
      console.log('Camera permission granted:', hasPermission);
      if (hasPermission) {
        setShowCamera(true);
      } else {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      Alert.alert('Error', 'Failed to request camera permission.');
    }
  };

  const handleGalleryPress = async () => {
    console.log('Gallery button pressed');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Gallery permission status:', status);
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is required to select photos.');
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('Image picker result:', result);
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('Image selected:', result.assets[0]);
        setCapturedImage(result.assets[0]);
        setShowCamera(false);
      }
    } catch (error) {
      console.error('Error selecting image from gallery:', error);
      Alert.alert('Error', 'Failed to select image from gallery. Please try again.');
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        setCapturedImage(photo);
        setShowCamera(false);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
    } else {
      Alert.alert('Camera Error', 'Camera is not ready. Please try again.');
    }
  };

  const handleConfirm = async () => {
    if (!capturedImage) {
      Alert.alert('No Image', 'Please capture or select an image first.');
      return;
    }

    setUploading(true);
    try {
      // Get current location
      let location = null;
      try {
        const locationResult = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        location = {
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
        };
      } catch (locationError) {
        console.warn('Could not get location:', locationError);
      }

      await onImageCaptured({
        image: capturedImage,
        type,
        description: description.trim(),
        location,
      });

      // Reset state
      setCapturedImage(null);
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

    const flipCamera = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleCancel = () => {
    setCapturedImage(null);
    setDescription('');
    setShowCamera(false);
    onClose();
  };

  const getTypeInfo = () => {
    switch (type) {
      case 'start_speedometer':
        return {
          icon: '🚗',
          title: 'Trip Start Photo',
          subtitle: 'Capture your speedometer before starting',
          placeholder: 'Starting odometer reading, fuel level, etc.'
        };
      case 'end_speedometer':
        return {
          icon: '🏁',
          title: 'Trip End Photo',
          subtitle: 'Capture your speedometer after completing trip',
          placeholder: 'Ending odometer reading, fuel consumed, etc.'
        };
      case 'journey_stop':
        return {
          icon: '⛽',
          title: 'Journey Stop',
          subtitle: 'Document your stop during the journey',
          placeholder: 'Petrol pump, rest area, meal break, etc.'
        };
      default:
        return {
          icon: '📸',
          title: title,
          subtitle: subtitle,
          placeholder: 'Add a description...'
        };
    }
  };

  const typeInfo = getTypeInfo();

  if (showCamera) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={cameraType}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setShowCamera(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>{typeInfo.title}</Text>
              <View style={styles.cameraButton} />
            </View>

            <View style={styles.cameraFooter}>
              <TouchableOpacity
                style={styles.galleryButton}
                onPress={handleGalleryPress}
              >
                <Ionicons name="images" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.flipButton}
                onPress={flipCamera}
              >
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {!capturedImage ? (
            // Initial selection screen
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalIcon}>{typeInfo.icon}</Text>
                <Text style={styles.modalTitle}>{typeInfo.title}</Text>
                <Text style={styles.modalSubtitle}>{typeInfo.subtitle}</Text>
              </View>

              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handleCameraPress}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name="camera" size={32} color="#007AFF" />
                  </View>
                  <Text style={styles.optionTitle}>Take Photo</Text>
                  <Text style={styles.optionSubtitle}>Use camera to capture image</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handleGalleryPress}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name="images" size={32} color="#007AFF" />
                  </View>
                  <Text style={styles.optionTitle}>Choose from Gallery</Text>
                  <Text style={styles.optionSubtitle}>Select existing photo</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Image preview and confirmation screen
            <>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>Confirm Image</Text>
                <TouchableOpacity onPress={() => setCapturedImage(null)}>
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: capturedImage.uri }} style={styles.imagePreview} />
              </View>

              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionLabel}>Description (Optional)</Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder={typeInfo.placeholder}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={200}
                />
              </View>

              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={styles.confirmCancelButton}
                  onPress={handleCancel}
                  disabled={uploading}
                >
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmButton, uploading && styles.confirmButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    width: width - 40,
    maxWidth: 400,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#6c757d',
    flex: 1,
    marginTop: 2,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '500',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  retakeText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  imagePreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 8,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#f8f9fa',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#6c757d',
  },
  confirmCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  confirmButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ImageCapture;
