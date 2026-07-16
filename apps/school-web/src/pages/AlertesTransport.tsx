import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, MapPin, Bus } from 'lucide-react';
import { getAlertes } from '../services/transport.service';

export default function AlertesTransport() {
  const [alertes, setAlertes] = useState<any[]>([]);

  useEffect(() => {
    fetchAlertes();
  }, []);

  const fetchAlertes = async () => {
    try {
      const data = await getAlertes();
      setAlertes(data);
    } catch (error) {
      // Dummy data
      setAlertes([
        { id: '1', type: 'MAUVAIS_CAR', message: 'L\'enfant est monté dans le mauvais car.', date: '2026-07-15', heure: '08:05', child: { firstName: 'Luc', lastName: 'Martin' } },
        { id: '2', type: 'GPS_HORS_ZONE', message: 'Validation à 150m du point d\'arrêt.', date: '2026-07-15', heure: '08:12', course: { nom: 'Aller Matin' } }
      ]);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <AlertTriangle className="text-red-600" size={32} />
          Alertes & Anomalies
        </h1>
        <p className="text-gray-500 mt-2">Historique des incidents détectés par l'algorithme de validation.</p>
      </div>

      <div className="space-y-4">
        {alertes.map((alerte, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-l-4 border-red-500 flex items-start gap-4">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 mt-1">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  {alerte.type.replace(/_/g, ' ')}
                </h3>
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock size={14} /> {alerte.date} à {alerte.heure}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3">{alerte.message}</p>
              
              <div className="flex flex-wrap gap-3 text-sm">
                {alerte.child && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                    Élève: {alerte.child.firstName} {alerte.child.lastName}
                  </span>
                )}
                {alerte.course && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 flex items-center gap-1">
                    <Bus size={14} /> Course: {alerte.course.nom}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
