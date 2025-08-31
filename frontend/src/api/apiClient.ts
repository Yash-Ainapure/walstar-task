import axios from 'axios'


const API_BASE = import.meta.env.VITE_API_BASE || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:5001/api' 
    : 'https://walstar-task.onrender.com/api')


const api = axios.create({ baseURL: API_BASE });


// Attach token if present
api.interceptors.request.use(cfg => {
const token = localStorage.getItem('token');
if (token) cfg.headers.set('Authorization', `Bearer ${token}`);
return cfg;
});


export default api;