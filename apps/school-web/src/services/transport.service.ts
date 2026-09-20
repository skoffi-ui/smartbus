import api from './api';

/**
 * Accès aux ressources transport de l'école.
 *
 * Ce module appelait auparavant un préfixe `/transport/*` qui n'a jamais existé
 * côté serveur : toutes ces pages étaient donc inertes. Les chemins ci-dessous
 * correspondent aux contrôleurs réels de l'APP école, et passent par le client
 * `api` partagé (jeton et gestion d'erreurs centralisés).
 */

// ─── Courses ────────────────────────────────────────────────────────────────
export const getCourses = async () => {
  const response = await api.get('/courses');
  return response.data;
};

export const getActiveCourses = async () => {
  const response = await api.get('/courses/active');
  return response.data;
};

export const createCourse = async (data: any) => {
  const response = await api.post('/courses', data);
  return response.data;
};

export const updateCourse = async (id: string, data: any) => {
  const response = await api.put(`/courses/${id}`, data);
  return response.data;
};

export const updateCourseStatus = async (id: string, statut: string) => {
  const response = await api.patch(`/courses/${id}/status`, { statut });
  return response.data;
};

export const deleteCourse = async (id: string) => {
  const response = await api.delete(`/courses/${id}`);
  return response.data;
};

// ─── Trajets ────────────────────────────────────────────────────────────────
export const getTrajets = async () => {
  const response = await api.get('/trajets');
  return response.data;
};

export const getTrajetById = async (id: string) => {
  const response = await api.get(`/trajets/${id}`);
  return response.data;
};

export const createTrajet = async (data: any) => {
  const response = await api.post('/trajets', data);
  return response.data;
};

export const updateTrajet = async (id: string, data: any) => {
  const response = await api.put(`/trajets/${id}`, data);
  return response.data;
};

export const updateTrajetGeojson = async (id: string, geojson: any) => {
  const response = await api.patch(`/trajets/${id}/geojson`, { geojson });
  return response.data;
};

export const deleteTrajet = async (id: string) => {
  const response = await api.delete(`/trajets/${id}`);
  return response.data;
};

// ─── Points de récupération ─────────────────────────────────────────────────
// Un point appartient à un TRAJET, et une course porte le trajet qu'elle exécute.
// Les helpers « par course » résolvent donc d'abord le trajet de la course.

export const getPoints = async (trajetId?: string) => {
  const response = await api.get('/points-recuperation', {
    params: trajetId ? { trajetId } : undefined,
  });
  return response.data;
};

export const createPoint = async (data: any) => {
  const response = await api.post('/points-recuperation', data);
  return response.data;
};

export const updatePoint = async (pointId: string, data: any) => {
  const response = await api.put(`/points-recuperation/${pointId}`, data);
  return response.data;
};

export const deletePoint = async (pointId: string) => {
  const response = await api.delete(`/points-recuperation/${pointId}`);
  return response.data;
};

export const reorderPoints = async (data: any) => {
  const response = await api.patch('/points-recuperation/reorder', data);
  return response.data;
};

/** Trajet exécuté par une course, ou null si la course n'en a pas encore. */
async function trajetIdOfCourse(courseId: string): Promise<string | null> {
  const response = await api.get(`/courses/${courseId}`);
  return response.data?.trajetId ?? null;
}

export const getPointsByCourse = async (courseId: string) => {
  const trajetId = await trajetIdOfCourse(courseId);
  if (!trajetId) return [];
  return getPoints(trajetId);
};

export const createPointForCourse = async (courseId: string, data: any) => {
  const trajetId = await trajetIdOfCourse(courseId);
  if (!trajetId) {
    throw new Error(
      "Cette course n'a pas encore de trajet : créez d'abord son trajet avant d'y ajouter des points.",
    );
  }
  return createPoint({ ...data, trajetId });
};

// ─── Affectations élève → point ─────────────────────────────────────────────
export const getAffectations = async () => {
  const response = await api.get('/affectations');
  return response.data;
};

export const getAffectationsByPoint = async (pointId: string) => {
  const response = await api.get(`/affectations/by-point/${pointId}`);
  return response.data;
};

export const getAffectationsByChild = async (childId: string) => {
  const response = await api.get(`/affectations/by-child/${childId}`);
  return response.data;
};

export const affecterEnfant = async (pointId: string, data: { childId: string; ordreMontee?: number }) => {
  const response = await api.post('/affectations', { ...data, pointId });
  return response.data;
};

export const supprimerAffectation = async (id: string) => {
  const response = await api.delete(`/affectations/${id}`);
  return response.data;
};

// ─── Suivi des montées & alertes ────────────────────────────────────────────
export const getMontees = async () => {
  const response = await api.get('/montees');
  return response.data;
};

export const getMonteesByChild = async (childId: string) => {
  const response = await api.get(`/montees/enfant/${childId}`);
  return response.data;
};

export const getAlertes = async () => {
  const response = await api.get('/montees/alertes');
  return response.data;
};

// ─── Géolocalisation ────────────────────────────────────────────────────────
export const reverseGeocode = async (lat: number, lng: number) => {
  const response = await api.get('/gps/geocode', { params: { lat, lng } });
  return response.data;
};

/** Positions en direct des bus de l'école. Lève une erreur si le suivi est indisponible. */
export const getLiveLocations = async () => {
  const response = await api.get('/gps/live');
  return response.data;
};
