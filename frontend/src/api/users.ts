import api from './apiClient'
import type { User } from '../types'


export const listUsers = () => api.get<User[]>('/users');
export const createUser = (payload: any) => api.post('/users', payload);
export const updateUser = (id: string, payload: any) => api.put(`/users/${id}`, payload);
export const deleteUser = (id: string) => api.delete(`/users/${id}`);