import axios from 'axios';

// Get API URL from environment or use current host
let API_URL = import.meta.env.VITE_API_URL;

// If API_URL contains localhost but we're not on localhost, use current host
if (API_URL && API_URL.includes('localhost') && window.location.hostname !== 'localhost') {
  API_URL = `${window.location.protocol}//${window.location.host}/api`;
}

const axiosClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token if available
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const authType = localStorage.getItem('authType') || 'jwt'; // default to jwt
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['X-Auth-Type'] = authType;
      console.debug(`✅ Auth header added (${authType}) to ${config.method?.toUpperCase()} ${config.url}`);
    } else {
      console.warn(`⚠️ No token found for ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle unauthorized errors
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('401 error on:', error.config?.url, 'Response:', error.response?.data);
      
      // Only logout if this was an authenticated request (had auth header)
      // and the error is for authentication, not authorization
      const hadAuthHeader = error.config?.headers?.Authorization;
      if (hadAuthHeader) {
        console.log('Authenticated request failed, logging out');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        console.log('Unauthenticated request got 401, not logging out');
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
