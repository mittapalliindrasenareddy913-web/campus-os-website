import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'https://student-os-backend-44v4.onrender.com/api';

const STORAGE_TOKEN_KEY   = 'campus_web_token';
const STORAGE_REFRESH_KEY = 'campus_web_refresh_token';

// ── Create base Axios instance ────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: inject JWT ──────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (token && token !== 'undefined' && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ── Token refresh state (prevents concurrent refresh calls) ──
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (newToken: string) => {
  refreshSubscribers.forEach(cb => cb(newToken));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

// ── Response interceptor: auto-refresh on 401 ────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401 and not if this IS the refresh call
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/campus/refresh'
    ) {
      const refreshToken = localStorage.getItem(STORAGE_REFRESH_KEY);

      if (!refreshToken || refreshToken === 'undefined') {
        // No refresh token — hard logout
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_REFRESH_KEY);
        localStorage.removeItem('campus_web_user');
        toast.error('Your session has expired. Please sign in again.', { id: 'session-expired' });
        setTimeout(() => { window.location.href = '/'; }, 1500);
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue while refresh is in progress
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_URL}/auth/campus/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const newAccessToken: string = data.accessToken;
        localStorage.setItem(STORAGE_TOKEN_KEY, newAccessToken);

        // Update Axios default header
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

        onRefreshed(newAccessToken);
        isRefreshing = false;

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        // Refresh itself failed — full logout
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_REFRESH_KEY);
        localStorage.removeItem('campus_web_user');
        toast.error('Your session has expired. Please sign in again.', { id: 'session-expired' });
        setTimeout(() => { window.location.href = '/'; }, 1500);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_URL };
