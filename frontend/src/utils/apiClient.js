import axios from 'axios';

// Default: same address as the website ('/api'); in development src/setupProxy.js forwards it to the
// backend. That way the site also works when opened from a phone via the laptop's network address.
// Set REACT_APP_API_URL only if the API lives elsewhere (e.g. a separately deployed backend).
const API_URL = process.env.REACT_APP_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
