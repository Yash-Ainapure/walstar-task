import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, Image, Modal } from 'react-native';
import { getMyProfile, updateMyProfile, updateMyPhotoBase64 } from '../api/auth';
// import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const getHtmlContent = () => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      height: 100vh; 
      margin: 0; 
      background-color: #f8f9fa;
    }
    #container { text-align: center; padding: 20px; }
    #uploadButton {
      background-color: #007AFF;
      color: white;
      padding: 15px 30px;
      border: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 14px 0 rgba(0, 118, 255, 0.39);
    }
    #loader { display: none; margin-top: 20px; font-size: 16px; color: #555; }
    h2 { color: #333; }
  </style>
</head>
<body>
  <input type="file" id="fileInput" accept="image/*" style="display: none;" />
  <div id="container">
    <h2>Update Profile Photo</h2>
    <button id="uploadButton">Choose from Gallery</button>
    <p id="loader">Processing, please wait...</p>
  </div>
  <script>
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const loader = document.getElementById('loader');
    const container = document.getElementById('container');

    // When the user clicks our visible button...
    uploadButton.addEventListener('click', () => {
      // ...then we can programmatically click the hidden file input.
      fileInput.click();
    });

    // This function sends data back to React Native
    const sendDataToReactNative = (data) => {
      window.ReactNativeWebView.postMessage(data);
    };

    // When the user selects a file...
    fileInput.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      // Hide the button and show the loader
      container.style.display = 'none';
      loader.style.display = 'block';

      const reader = new FileReader();
      reader.onload = (e) => {
        // Send the Base64 string of the image back to the app
        sendDataToReactNative(e.target.result);
      };
      reader.readAsDataURL(file);
    };
  </script>
</body>
</html>
`;



const ProfileScreen = ({ navigation }) => {
    const [user, setUser] = useState(null);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                const response = await getMyProfile();
                setUser(response.data);
                setName(response.data.name || '');
                setUsername(response.data.username || '');
                setPhone(response.data.phone || '');
                setAddress(response.data.address || '');
            } catch (error) {
                console.error('Failed to fetch profile:', error);
                Alert.alert('Error', 'Could not load your profile.');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleWebViewMessage = async (event) => {
        setModalVisible(false); 
        setUploading(true);
        try {
            const base64String = event.nativeEvent.data;
            const response = await updateMyPhotoBase64(base64String);
            setUser(response.data); 
            Alert.alert('Success', 'Profile photo updated!');
        } catch (error) {
            let errorMessage = "Could not update your photo.";

            if (error.response) {
                if (error.response.status === 413) {
                    errorMessage = "Image too large. Maximum size allowed is 1 MB.";
                } else {
                    errorMessage = error.response.data?.message || errorMessage;
                }
            } else if (error.request) {
                errorMessage = "No response from server. Please try again.";
            } else {
                errorMessage = error.message;
            }

            Alert.alert("Error", errorMessage);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const updatedData = { name, username, phone, address };
            const response = await updateMyProfile(updatedData);
            setUser(response.data);
            Alert.alert('Success', 'Profile updated successfully!');
        } catch (error) {
            console.error('Failed to update profile:', error);
            Alert.alert('Error', 'Could not update your profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Modal
                animationType="slide"
                transparent={false}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <WebView
                    source={{ html: getHtmlContent() }}
                    onMessage={handleWebViewMessage}
                    javaScriptEnabled={true}
                />
            </Modal>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.profileHeader}>
                    <TouchableOpacity onPress={() => setModalVisible(true)} disabled={uploading}>
                        <Image
                            source={{ uri: `${user?.photoUrl}` }}
                            style={styles.avatar}
                        />
                        <View style={styles.avatarOverlay}>
                            {uploading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Ionicons name="camera" size={30} color="rgba(255,255,255,0.85)" />
                            )}
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.profileName}>{user?.name}</Text>
                    <Text style={styles.profileRole}>{user?.role.charAt(0).toUpperCase() + user?.role.slice(1)}</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address </Text>
                        <TextInput
                            style={[styles.input, styles.disabledInput]}
                            value={user?.username}
                            editable={false}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput style={styles.input} value={name} onChangeText={setName} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Address</Text>
                        <TextInput style={[styles.input, { height: 80 }]} value={address} onChangeText={setAddress} multiline />
                    </View>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    scrollContainer: { paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        backgroundColor: '#fff',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
    headerSubtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
    form: { padding: 24 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: {
        backgroundColor: '#FFFFFF',
        height: 50,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    disabledInput: { backgroundColor: '#F3F4F6', color: '#6B7280' },
    helperText: { fontSize: 12, color: '#6B7280', marginTop: 4 },
    saveButton: {
        backgroundColor: '#007AFF',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // ... (use styles from previous response, with these additions) ...
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 30,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: '#007AFF',
        marginBottom: 10,
    },
    profileName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
    },
    profileRole: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 4,
    },
});

export default ProfileScreen;