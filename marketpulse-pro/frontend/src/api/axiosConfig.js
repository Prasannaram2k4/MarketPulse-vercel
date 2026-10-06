import axios from 'axios';

const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim();
export const API_BASE_URL = configuredBackendUrl
  ? configuredBackendUrl.replace(/\/+$/, '')
  : '';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add a request interceptor to include the token in headers
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;