import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Bus, User, RefreshCw, ShieldCheck, Filter } from 'lucide-react';
import { getAlertes } from '../services/transport.service';
import { messageFromError } from '../services/api';

interface Alerte {
  id: string;
  type: string;
  description?: string;
  message?: string;
  date?: string;
  heure?: string;
  child?: { firstName?: string; lastName?: string };
  course?: { nom?: string };
  car?: { plateNumber?: string };
}

/** Libellés lisibles des types d'anomalie produits par la validation des pointages. */
const LIBELLES: Record<string, string> = {
  mauvais_car: 'Mauvais car',
  mauvais_arret: 'Mauvais arrêt',
  course_inactive: 'Aucune course active',
  enfant_non_affecte: 'Élève non affecté',
  gps_hors_zone: 'Badgeage hors zone GPS',
  badge_hors_horaire: 'Badgeage hors horaire',
  double_validation: 'Double validation',
};

const GRAVITE_HAUTE = new Set(['mauvais_car', 'mauvais_arret', 'enfant_non_affecte']);

const libelle = (type: string) => LIBELLES[type?.toLowerCase()] ?? type?.replace(/_/g, ' ') ?? '—';

export default function AlertesTransport() {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [typeFiltre, setTypeFiltre] = useState('toutes');

  const charger = async () => {
    setChargement(true);
    setErreur('');
    try {
      const data = await getAlertes();
      setAlertes(Array.isArray(data) ? data : []);
    } catch (err) {
      // Pas de données de démonstration : une page qui invente des anomalies
      // masque le fait que la chaîne de validation ne remonte rien.
      setAlertes([]);
      setErreur(messageFromError(err, 'Impossible de charger les anomalies.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const types = useMemo(
    () => [...new Set(alertes.map((a) => a.type).filter(Boolean))],
    [alertes],
  );

  const visibles = useMemo(
    () => (typeFiltre === 'toutes' ? alertes : alertes.filter((a) => a.type === typeFiltre)),
    [alertes, typeFiltre],
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="text-red-600" size={32} />
            Alertes &amp; Anomalies
          </h1>
          <p className="text-gray-500 mt-2">
            Incidents détectés lors de la validation des badgeages : mauvais bus, mauvais arrêt,
            élève non affecté, badgeage hors zone.
          </p>
        </div>
        <button
          onClick={charger}
          disabled={chargement}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 disabled:opacity-50"
        >
          <RefreshCw size={15} className={chargement ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {erreur && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* Filtres, affichés seulement s'il y a de quoi filtrer */}
      {types.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-gray-500 mr-1">
            <Filter size={14} /> Type
          </span>
          {['toutes', ...types].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFiltre(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                typeFiltre === t
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-transparent border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'toutes' ? `Toutes (${alertes.length})` : libelle(t)}
            </button>
          ))}
        </div>
      )}

      {chargement && (
        <p className="text-center text-gray-500 py-10">
          Chargement des anomalies…
        </p>
      )}

      {/* Aucune anomalie : c'est une bonne nouvelle, et on explique ce qui les produit */}
      {!chargement && alertes.length === 0 && !erreur && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="inline-flex p-3 rounded-full bg-green-100 text-green-600 mb-4">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Aucune anomalie enregistrée
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Une anomalie apparaît ici lorsqu'un élève badge dans un bus qui n'est pas le sien, à un
            arrêt qui n'est pas le sien, sans course active, ou trop loin de son arrêt. Tant
            qu'aucun badgeage n'a été refusé, cette page reste vide.
          </p>
        </div>
      )}

      {!chargement && alertes.length > 0 && visibles.length === 0 && (
        <p className="text-center text-gray-500 py-10">
          Aucune anomalie de ce type.
        </p>
      )}

      <div className="space-y-4">
        {visibles.map((alerte, idx) => {
          const haute = GRAVITE_HAUTE.has(alerte.type?.toLowerCase());
          return (
            <div
              key={alerte.id ?? idx}
              className={`bg-white p-5 rounded-xl shadow-sm border-l-4 flex items-start gap-4 ${
                haute ? 'border-red-500' : 'border-amber-500'
              }`}
            >
              <div
                className={`p-2 rounded-full mt-1 ${
                  haute
                    ? 'bg-red-100 text-red-600'
                    : 'bg-amber-100 text-amber-600'
                }`}
              >
                <AlertTriangle size={24} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {libelle(alerte.type)}
                  </h3>
                  {(alerte.date || alerte.heure) && (
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock size={14} />
                      {alerte.date ? new Date(alerte.date).toLocaleDateString('fr-FR') : ''}
                      {alerte.heure ? ` à ${alerte.heure}` : ''}
                    </span>
                  )}
                </div>

                <p className="text-gray-700 mb-3">
                  {alerte.description ?? alerte.message ?? 'Aucun détail enregistré.'}
                </p>

                <div className="flex flex-wrap gap-2 text-sm">
                  {alerte.child && (
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-600 flex items-center gap-1">
                      <User size={14} /> {alerte.child.firstName} {alerte.child.lastName}
                    </span>
                  )}
                  {alerte.course?.nom && (
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-600 flex items-center gap-1">
                      <Bus size={14} /> {alerte.course.nom}
                    </span>
                  )}
                  {alerte.car?.plateNumber && (
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-600">
                      {alerte.car.plateNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
