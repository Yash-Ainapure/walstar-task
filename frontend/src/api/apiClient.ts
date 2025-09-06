import axios from 'axios'


const API_BASE = import.meta.env.VITE_API_BASE ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:5001/api'
    : 'https://walstar-task.onrender.com/api')


const api = axios.create({ baseURL: API_BASE });


// Attach token if present
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  // Ensure Content-Type is set for POST requests
  if (
    cfg.method === 'post' &&
    !cfg.headers['Content-Type'] &&
    !(cfg.data instanceof FormData)
  ) {
    cfg.headers['Content-Type'] = 'application/json';
  }

  // Debug logging
  // console.log('API Request:', {
  //   method: cfg.method,
  //   url: cfg.url,
  //   baseURL: cfg.baseURL,
  //   data: cfg.data,
  //   headers: cfg.headers
  // });

  return cfg;
});

// Add response interceptor for error logging
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      config: error.config
    });
    return Promise.reject(error);
  }
);


export default api;