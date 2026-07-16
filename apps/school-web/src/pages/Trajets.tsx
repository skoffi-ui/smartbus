import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet-draw';
import { Map, Save } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { getCourses, updateTrajet } from '../services/transport.service';

// Composant interne pour monter Leaflet.draw sans react-leaflet-draw
function LeafletDrawControl({ onGeoJsonChange }: { onGeoJsonChange: (geojson: any) => void }) {
  const map = useMap();

  useEffect(() => {
    // Groupe pour stocker les éléments dessinés
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialisation du contrôle de dessin
    const drawControl = new L.Control.Draw({
      draw: {
        rectangle: false,
        circle: false,
        circlemarker: false,
        polygon: false,
        polyline: {
          shapeOptions: {
            color: '#3b82f6',
            weight: 4
          }
        },
        marker: true
      },
      edit: {
        featureGroup: drawnItems
      }
    });

    map.addControl(drawControl);

    // Écouteur de création
    map.on(L.Draw.Event.CREATED, (e: any) => {
      drawnItems.addLayer(e.layer);
      // Mettre à jour le state parent
      onGeoJsonChange(drawnItems.toGeoJSON());
    });

    // Écouteur d'édition
    map.on(L.Draw.Event.EDITED, () => {
      onGeoJsonChange(drawnItems.toGeoJSON());
    });

    // Écouteur de suppression
    map.on(L.Draw.Event.DELETED, () => {
      onGeoJsonChange(drawnItems.toGeoJSON());
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
      map.off(L.Draw.Event.CREATED);
      map.off(L.Draw.Event.EDITED);
      map.off(L.Draw.Event.DELETED);
    };
  }, [map, onGeoJsonChange]);

  return null;
}

export default function Trajets() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [mapLayers, setMapLayers] = useState<any>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const data = await getCourses();
      setCourses(data);
    } catch (error) {
      console.error('Failed to fetch courses', error);
    }
  };

  const handleSave = async () => {
    if (!selectedCourse) {
      alert('Veuillez sélectionner une course avant d\'enregistrer le trajet.');
      return;
    }
    if (!mapLayers) {
      alert('Aucun trajet à sauvegarder.');
      return;
    }

    try {
      await updateTrajet('new-trajet', { courseId: selectedCourse, geoJson: mapLayers });
      alert('Trajet sauvegardé avec succès !');
    } catch (error) {
      console.error('Erreur de sauvegarde', error);
      alert('Erreur lors de la sauvegarde du trajet.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Map className="text-blue-600" size={32} />
            Trajets & Points de Récupération
          </h1>
          <p className="text-gray-500 mt-2">Dessinez le trajet et placez les arrêts pour la course sélectionnée.</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <select 
            value={selectedCourse} 
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Sélectionnez une Course --</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.nom}</option>
            ))}
          </select>

          <button 
            onClick={handleSave}
            disabled={!selectedCourse}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save size={20} />
            Enregistrer GeoJSON
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative z-0 min-h-[600px]">
        <MapContainer 
          center={[48.8566, 2.3522]} // Paris par défaut
          zoom={13} 
          style={{ height: '100%', minHeight: '600px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <LeafletDrawControl onGeoJsonChange={setMapLayers} />
        </MapContainer>
      </div>
    </div>
  );
}
