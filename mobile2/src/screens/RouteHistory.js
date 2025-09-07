import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import axios from 'axios';
import { AuthContext } from '../navigation/AuthContext';
import API_BASE_URL from '../api/config';
import moment from 'moment'; // for formatting dates

const API_BASE_URL_WITH_ROUTE = `${API_BASE_URL}/api/routes`;

const RouteHistory = ({ navigation }) => {
    const [dates, setDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loadingDates, setLoadingDates] = useState(true);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [error, setError] = useState('');

    const { user, token } = useContext(AuthContext);

    // Fetch dates
    useEffect(() => {
        const fetchDates = async () => {
            if (!user || !token) {
                console.log('no token or user object');
                return;
            }

            try {   
                setLoadingDates(true);
                console.log('getting dates...');
                const response = await axios.get(`${API_BASE_URL_WITH_ROUTE}/${user._id}/dates`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                console.log(response.data.dates);
                setDates(response.data.dates);
                setLoadingDates(false);
            } catch (err) {
                setError('Failed to fetch dates');
                console.log(err.response?.data || err.message);
                setLoadingDates(false);
            }
        };
        fetchDates();
    }, [user, token]);

    // Fetch sessions
    const fetchSessions = async (date) => {
        if (!user || !token) {
            console.log('no token or user object');
            return;
        }

        try {
            setSelectedDate(date);
            setLoadingSessions(true);
            const response = await axios.get(`${API_BASE_URL_WITH_ROUTE}/${user._id}/${date}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSessions(response.data.sessions); // array of sessions
            setLoadingSessions(false);
        } catch (err) {
            setError('Failed to fetch sessions');
            console.log(err.response?.data || err.message);
            setLoadingSessions(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Route History</Text>

            {/* Dates horizontal list */}
            {loadingDates ? (
                <ActivityIndicator size="large" color="#3498db" />
            ) : (
                <FlatList
                    style={{ maxHeight: 65 }}
                    data={dates}
                    keyExtractor={(item) => item}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: 10 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.dateButton, selectedDate === item && styles.selectedDateButton]}
                            onPress={() => fetchSessions(item)}
                        >
                            <Text style={[styles.dateText, selectedDate === item && styles.selectedDateText]}>
                                {moment(item).format('MMM DD')}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Sessions list */}
            {loadingSessions ? (
                <ActivityIndicator size="large" color="#2ecc71" style={{ marginTop: 20 }} />
            ) : (
                <View style={{ maxHeight: 400 }}>
                    {sessions.length > 0 ? (
                        <FlatList
                            data={sessions}
                            keyExtractor={(item) => item.sessionId}
                            contentContainerStyle={{ paddingVertical: 10 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.sessionCard} onPress={() => navigation.navigate('SessionMap', { session: item })}>
                                    <Text style={styles.sessionName}>{item.name || 'Unnamed Trip'}</Text>
                                    <View style={styles.timeRow}>
                                        <Text style={styles.timeLabel}>Start:</Text>
                                        <Text style={styles.timeValue}>{moment(item.startTime).format('hh:mm A')}</Text>
                                        <Text style={[styles.timeLabel, { marginLeft: 20 }]}>End:</Text>
                                        <Text style={styles.timeValue}>{moment(item.endTime).format('hh:mm A')}</Text>
                                    </View>
                                    <Text style={styles.sessionId}>Session ID: {item.sessionId}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    ) : selectedDate ? (
                        <Text style={{ marginTop: 20, fontSize: 16 }}>No sessions for this date</Text>
                    ) : null}
                </View>
            )}


            {error !== '' && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}
        </View>
    );
};

export default RouteHistory;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
    title: { fontSize: 26, fontWeight: 'bold', marginBottom: 15, color: '#333' },
    dateButton: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        marginRight: 10,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#3498db',
        backgroundColor: '#fff',
    },
    selectedDateButton: { backgroundColor: '#3498db' },
    dateText: { fontSize: 14, color: '#3498db', fontWeight: '500' },
    selectedDateText: { color: '#fff' },
    sessionCard: {
        backgroundColor: '#fff',
        padding: 15,
        marginVertical: 8,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
    },
    sessionName: { fontSize: 18, fontWeight: '600', color: '#2c3e50', marginBottom: 8 },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    timeLabel: { fontSize: 14, color: '#7f8c8d' },
    timeValue: { fontSize: 14, fontWeight: '500', color: '#34495e', marginLeft: 5 },
    sessionId: { fontSize: 12, color: '#95a5a6', marginTop: 4 },
});
