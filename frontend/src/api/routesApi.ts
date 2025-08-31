import api from './apiClient'
import type { DateBucket } from '../types'


export const syncRoute = (route: any) => api.post('/routes/sync', route);
export const getDates = (userId: string) => api.get<{ dates: string[] }>(`/routes/${userId}/dates`);
export const getSessionsByDate = (userId: string, date: string) => api.get<DateBucket>(`/routes/${userId}/${date}`);
export const getSessionById = (userId: string, sessionId: string) => api.get(`/routes/${userId}/session/${sessionId}`);
export const osrmRoute = (coords: string) => api.get(`/routes/osrm/route?coords=${encodeURIComponent(coords)}`);