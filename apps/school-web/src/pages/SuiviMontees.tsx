import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, AlertTriangle, Bus, Users } from 'lucide-react';
import { getMontees } from '../services/transport.service';

export default function SuiviMontees() {
  const [montees, setMontees] = useState<any[]>([]);

  useEffect(() => {
    fetchMontees();
  }, []);

  const fetchMontees = async () => {
    try {
      const data = await getMontees();
      setMontees(data);
    } catch (error) {
      console.error('Erreur fetch montees', error);
      // Dummy data for visual
      setMontees([
        { id: '1', child: { firstName: 'Jean', lastName: 'Dupont' }, course: { nom: 'Aller Matin' }, point: { nom: 'Mairie' }, date: '2026-07-15', heure: '07:45', statut: 'valide' },
        { id: '2', child: { firstName: 'Marie', lastName: 'Curie' }, course: { nom: 'Aller Matin' }, point: { nom: 'Gare' }, date: '2026-07-15', heure: '08:00', statut: 'refuse' }
      ]);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-100px)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Activity className="text-blue-600" size={32} />
          Tableau de Bord & Suivi
        </h1>
        <p className="text-gray-500 mt-2">Vue d'ensemble de l'activité du transport scolaire.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
            <Bus size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Courses en cours</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Élèves transportés</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">142</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Montées validées</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">138</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Alertes / Refus</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">4</p>
          </div>
        </div>
      </div>

      {/* Historique Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Historique des Montées</h2>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Élève</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Course</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Point</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Date & Heure</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Statut</th>
              </tr>
            </thead>
            <tbody>
              {montees.map((montee, idx) => (
                <tr key={idx} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="p-4 text-gray-900 dark:text-white font-medium">{montee.child?.firstName} {montee.child?.lastName}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400">{montee.course?.nom}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400">{montee.point?.nom}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400">{montee.date} - {montee.heure}</td>
                  <td className="p-4">
                    {montee.statut === 'valide' ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium"><CheckCircle size={16} /> Validé</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-medium"><XCircle size={16} /> Refusé</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
