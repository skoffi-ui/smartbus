import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Bus,
  Users,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
} from 'lucide-react';
import { getMontees } from '../services/transport.service';
import { messageFromError } from '../services/api';

export default function SuiviMontees() {
  const [montees, setMontees] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetchMontees();
  }, []);

  const fetchMontees = async () => {
    setChargement(true);
    setErreur('');
    try {
      const data = await getMontees();
      setMontees(Array.isArray(data) ? data : []);
    } catch (error) {
      // Aucune donnée de démonstration ici : un écran qui invente des pointages
      // empêche de voir que la chaîne de badgeage ne remonte rien.
      setMontees([]);
      setErreur(
        messageFromError(
          error,
          "Impossible de charger l'historique des pointages.",
        ),
      );
    } finally {
      setChargement(false);
    }
  };

  // Compteurs calculés sur les données réelles, et non plus codés en dur.
  const stats = useMemo(() => {
    const valides = montees.filter((m) => m.statut === 'valide');
    return {
      courses: new Set(
        montees.map((m) => m.courseId ?? m.course?.id).filter(Boolean),
      ).size,
      eleves: new Set(
        montees.map((m) => m.childId ?? m.child?.id).filter(Boolean),
      ).size,
      montees: valides.filter((m) => m.sens !== 'descente').length,
      descentes: valides.filter((m) => m.sens === 'descente').length,
      refus: montees.filter((m) => m.statut === 'refuse').length,
    };
  }, [montees]);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-100px)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Activity className="text-blue-600" size={32} />
          Tableau de Bord &amp; Suivi
        </h1>
        <p className="text-gray-500 mt-2">
          Chaque badgeage d'un enfant dans un car, avec son sens et le verdict
          de validation.
        </p>
      </div>

      {/* Indicateurs, calculés sur les pointages réellement remontés */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Bus size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Courses concernées
            </p>
            <p className="text-2xl font-bold text-gray-900">{stats.courses}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Élèves transportés
            </p>
            <p className="text-2xl font-bold text-gray-900">{stats.eleves}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Montées / Descentes
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.montees} / {stats.descentes}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Pointages refusés
            </p>
            <p className="text-2xl font-bold text-gray-900">{stats.refus}</p>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Historique des pointages
          </h2>
          <button
            onClick={fetchMontees}
            disabled={chargement}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 disabled:opacity-50"
          >
            <RefreshCw size={15} className={chargement ? 'animate-spin' : ''} />{' '}
            Actualiser
          </button>
        </div>

        {erreur && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {erreur}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600">Élève</th>
                <th className="p-4 font-semibold text-gray-600">Sens</th>
                <th className="p-4 font-semibold text-gray-600">Course</th>
                <th className="p-4 font-semibold text-gray-600">Arrêt</th>
                <th className="p-4 font-semibold text-gray-600">
                  Date &amp; Heure
                </th>
                <th className="p-4 font-semibold text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody>
              {montees.map((montee, idx) => (
                <tr
                  key={montee.id ?? idx}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="p-4 text-gray-900 font-medium">
                    {montee.child?.firstName} {montee.child?.lastName}
                  </td>
                  <td className="p-4">
                    {montee.sens === 'descente' ? (
                      <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
                        <ArrowDownCircle size={16} /> Descente
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
                        <ArrowUpCircle size={16} /> Montée
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-600">{montee.course?.nom}</td>
                  <td className="p-4 text-gray-600">
                    {montee.point?.nom ?? '—'}
                  </td>
                  <td className="p-4 text-gray-600">
                    {montee.date} - {montee.heure}
                  </td>
                  <td className="p-4">
                    {montee.statut === 'valide' ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle size={16} /> Validé
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-red-600 text-sm font-medium"
                        title={montee.validationMessage || ''}
                      >
                        <XCircle size={16} /> Refusé
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {!chargement && montees.length === 0 && !erreur && (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <p className="font-semibold text-gray-700 mb-2">
                      Aucun pointage enregistré
                    </p>
                    <p className="text-sm text-gray-500 max-w-lg mx-auto">
                      Une ligne apparaît ici dès qu'un élève badge dans un car.
                      Il faut pour cela que la badgeuse du car soit allouée à
                      l'école, que le car porte son numéro de série, que l'élève
                      ait un matricule et soit affecté à un arrêt du trajet, et
                      qu'une course soit active sur ce car.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
