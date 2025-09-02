import api from './apiClient'


export const login = (username: string, password: string) => {
  console.log('Login called with:', { username, password });
  return api.post('/auth/login', { username, password });
};
export const register = (payload: any) => api.post('/auth/register', payload);