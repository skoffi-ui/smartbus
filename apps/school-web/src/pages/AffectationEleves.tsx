import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Trash2, MapPin } from 'lucide-react';
import { getCourses } from '../services/transport.service';

export default function AffectationEleves() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [points, setPoints] = useState<any[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dummy data pour les élèves (normalement récupéré via API)
  const [elevesAffectes, setElevesAffectes] = useState<any[]>([
    { id: '1', name: 'Élève 1', classe: 'CP A' },
    { id: '2', name: 'Élève 2', classe: 'CE1 B' },
  ]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const data = await getCourses();
      setCourses(data);
      // Dummy points for demo
      setPoints([
        { id: 'p1', nom: 'Point A (Mairie)' },
        { id: 'p2', nom: 'Point B (Gare)' }
      ]);
    } catch (error) {
      console.error('Erreur', error);
    }
  };

  const handleAffecter = (eleve: any) => {
    alert(`Élève ${eleve.name} affecté au point ${selectedPoint?.nom}`);
  };

  const handleDesaffecter = (eleveId: string) => {
    setElevesAffectes(elevesAffectes.filter(e => e.id !== eleveId));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-100px)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Users className="text-blue-600" size={32} />
          Affectation des Élèves
        </h1>
        <p className="text-gray-500 mt-2">Associez les élèves aux points de récupération.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Colonne Gauche : Sélection Course & Points */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">1. Sélection du Point</h2>
          
          <select 
            value={selectedCourse} 
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full mb-4 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white"
          >
            <option value="">-- Choisir une Course --</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>

          <div className="flex-1 overflow-y-auto space-y-2">
            {points.map(point => (
              <button
                key={point.id}
                onClick={() => setSelectedPoint(point)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${selectedPoint?.id === point.id ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 text-blue-700 dark:text-blue-300' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300'}`}
              >
                <MapPin size={18} />
                <span className="font-medium text-left">{point.nom}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Colonne Droite : Élèves affectés & Recherche */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col">
          {!selectedPoint ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Veuillez sélectionner un point de récupération à gauche.
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Élèves affectés à : <span className="text-blue-600">{selectedPoint.nom}</span>
                </h2>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Rechercher un élève..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-64"
                  />
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                </div>
              </div>

              {/* Liste des élèves (Mockup) */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-3 font-medium">Nom de l'élève</th>
                      <th className="pb-3 font-medium">Classe</th>
                      <th className="pb-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevesAffectes.map((eleve) => (
                      <tr key={eleve.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="py-3 text-gray-900 dark:text-white font-medium">{eleve.name}</td>
                        <td className="py-3 text-gray-600 dark:text-gray-400">{eleve.classe}</td>
                        <td className="py-3 text-right">
                          <button 
                            onClick={() => handleDesaffecter(eleve.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Désaffecter"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
