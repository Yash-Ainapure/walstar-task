import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const ImageViewer = ({ visible, onClose, image, onDelete }) => {
  if (!image) return null;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'start_speedometer':
        return '🚗';
      case 'end_speedometer':
        return '🏁';
      case 'journey_stop':
        return '⛽';
      default:
        return '📸';
    }
  };

  const getTypeTitle = (type) => {
    switch (type) {
      case 'start_speedometer':
        return 'Trip Start';
      case 'end_speedometer':
        return 'Trip End';
      case 'journey_stop':
        return 'Journey Stop';
      default:
        return 'Image';
    }
  };

  const formatDateTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (error) {
      return timestamp;
    }
  };

  const formatLocation = (location) => {
    if (!location || !location.latitude || !location.longitude) {
      return 'Location not available';
    }
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.headerIcon}>{getTypeIcon(image.type)}</Text>
            <Text style={styles.headerTitle}>{getTypeTitle(image.type)}</Text>
          </View>

          {onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Ionicons name="trash" size={24} color="#ff4757" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: image.url }} style={styles.image} resizeMode="contain" />
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="time" size={20} color="#007AFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(image.timestampIST || image.timestampUTC)}
                </Text>
              </View>
            </View>

            {image.location && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="location" size={20} color="#007AFF" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{formatLocation(image.location)}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="pricetag" size={20} color="#007AFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>{getTypeTitle(image.type)}</Text>
              </View>
            </View>

            {image.description && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="document-text" size={20} color="#007AFF" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>{image.description}</Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    height: height * 0.5,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: '100%',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    minHeight: height * 0.4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '400',
    lineHeight: 22,
  },
});

export default ImageViewer;
