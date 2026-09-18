import axios from 'axios';
import api from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const transportApi = axios.create({
  baseURL: `${API_URL}/transport`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add auth token
transportApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getCourses = async () => {
  const response = await transportApi.get('/courses');
  return response.data;
};

// Géocodage
export const reverseGeocode = async (lat: number, lng: number) => {
  const response = await api.get(`/gps/geocode?lat=${lat}&lng=${lng}`);
  return response.data;
};

export const createCourse = async (data: any) => {
  const response = await transportApi.post('/courses', data);
  return response.data;
};

export const updateCourse = async (id: string, data: any) => {
  const response = await transportApi.put(`/courses/${id}`, data);
  return response.data;
};

export const deleteCourse = async (id: string) => {
  const response = await transportApi.delete(`/courses/${id}`);
  return response.data;
};

// Trajets
export const getTrajets = async () => {
  const response = await transportApi.get('/trajets');
  return response.data;
};

export const getTrajetById = async (id: string) => {
  const response = await transportApi.get(`/trajets/${id}`);
  return response.data;
};

export const createTrajet = async (data: any) => {
  const response = await transportApi.post('/trajets', data);
  return response.data;
};

export const updateTrajet = async (id: string, data: any) => {
  const response = await transportApi.put(`/trajets/${id}`, data);
  return response.data;
};

export const deleteTrajet = async (id: string) => {
  const response = await transportApi.delete(`/trajets/${id}`);
  return response.data;
};

// Points
export const createPoint = async (data: any) => {
  const response = await transportApi.post('/points', data);
  return response.data;
};

export const getPointsByCourse = async (courseId: string) => {
  const response = await transportApi.get(`/courses/${courseId}/points`);
  return response.data;
};

export const createPointForCourse = async (courseId: string, data: any) => {
  const response = await transportApi.post(`/courses/${courseId}/points`, data);
  return response.data;
};

export const deletePoint = async (pointId: string) => {
  const response = await transportApi.delete(`/points/${pointId}`);
  return response.data;
};

// Affectations
export const affecterEnfant = async (pointId: string, data: any) => {
  const response = await transportApi.post(`/points/${pointId}/enfants`, data);
  return response.data;
};

// Historique & Alertes
export const getMontees = async () => {
  const response = await transportApi.get('/montees');
  return response.data;
};

export const getAlertes = async () => {
  const response = await transportApi.get('/alertes');
  return response.data;
};
