import axios from 'axios';

/**
 * Configure standard Axios instance with the base API url.
 * It will fall back to localhost:8000 if NEXT_PUBLIC_API_URL is not configured.
 * This client is dedicated to Super Admin pages and uses the 'super_admin_token'.
 */
const superAdminApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Axios Request Interceptor:
 * Before every request is sent out to the backend, check if a super admin JWT token
 * is present in the browser's localStorage. If found, add it to the
 * HTTP "Authorization" header as a Bearer token.
 */
superAdminApi.interceptors.request.use(
  (config) => {
    // Only access window/localStorage on the client-side (browsers)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('super_admin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    // If the request setup fails, pass the error along
    return Promise.reject(error);
  }
);

export default superAdminApi;
