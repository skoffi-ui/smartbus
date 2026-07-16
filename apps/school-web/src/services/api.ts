import axios from 'axios';

// L'API School App est hébergée sur le port 3001
const API_BASE_URL = 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Ajouter le token (s'il existe) à toutes les requêtes automatiquement
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Gérer la déconnexion si le token est invalide (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 || 
      (error.response?.status === 404 && error.response?.data?.message?.includes('introuvable'))
    ) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
