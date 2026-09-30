import { useEffect, useState } from 'react';
import {
  MapPin,
  Building2,
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Search,
  Satellite,
} from 'lucide-react';
import api, { messageFromError } from '../services/api';
import { useConfirm } from '../components/ConfirmProvider';

/**
 * Un appareil de l'inventaire central (table `devices`, voir
 * `DevicesService.findAll` — apps/super-app/src/modules/devices/devices.service.ts).
 * Réponse en SQL brut : les clés restent en snake_case, à la différence du
 * reste de l'API (TypeORM, camelCase).
 */
interface DeviceCentral {
  id: string;
  serial_number: string;
  type_device: 'GPS' | 'BADGEUSE';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';
  last_seen_at: string | null;
  created_at: string;
  imei: string | null;
  assigned_organisation_id: string | null;
  assigned_organisation_name: string | null;
}

interface Organisation {
  id: string;
  name: string;
  code: string;
}

/** Réponse de `GET /devices/gpswox-sante` — voir `GpswoxService.getSante`. */
interface SanteGpswox {
  configured: boolean;
  dernierSuccesA: string | null;
  echecsConsecutifs: number;
  enPanne: boolean;
}

/**
 * Assignation des appareils GPS (GPSWOX, Traccar, Libellule…) aux écoles.
 *
 * Le backend (`DevicesController`/`DevicesService`) existait déjà, complet,
 * mais aucune page ne le consommait — les appareils s'inscrivaient tout
 * seuls dans l'inventaire central dès leur première position reçue (voir
 * `HardwareStreamService.ensureDeviceRegistered`), sans aucun moyen de les
 * assigner à une école depuis l'interface. C'est cette page qui referme ce
 * manque, sur le même gabarit que « Gestion BioTime Centralisée ».
 *
 * Assigner ici ne dit que « cet appareil appartient à cette école ». Le lien
 * fin — quel appareil correspond à quel bus précis — se fait ensuite côté
 * école, dans Cars.tsx (menu « Périphérique GPS », déjà existant, alimenté
 * par `GET /cars/allocated-devices`).
 */
export default function VehiculesGps() {
  const confirmer = useConfirm();
  const [appareils, setAppareils] = useState<DeviceCentral[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceCentral | null>(
    null,
  );
  const [selectedOrgForAssign, setSelectedOrgForAssign] = useState('');
  const [sante, setSante] = useState<SanteGpswox | null>(null);

  const chargerDonnees = async () => {
    setLoading(true);
    setError('');
    try {
      const [devicesRes, orgsRes] = await Promise.all([
        api.get('/devices'),
        api.get('/organisations', { params: { limit: 100 } }),
      ]);
      const tousAppareils: DeviceCentral[] = Array.isArray(devicesRes.data)
        ? devicesRes.data
        : [];
      // `/devices` couvre tout le parc (badgeuses + GPS) : cette page ne
      // concerne que les véhicules GPS.
      setAppareils(tousAppareils.filter((d) => d.type_device === 'GPS'));
      setOrganisations(
        Array.isArray(orgsRes.data?.data) ? orgsRes.data.data : [],
      );
    } catch (err) {
      setError(messageFromError(err, 'Impossible de charger les données.'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Santé du sondage GPSWOX — avant ça, un GPSWOX injoignable ne se voyait
   * que dans les logs de super-app, jamais ici où un admin regarderait
   * réellement. Rafraîchie à chaque chargement de la page (pas de polling
   * continu : cette page n'est pas censée rester ouverte en permanence).
   */
  useEffect(() => {
    chargerDonnees();
    api
      .get('/devices/gpswox-sante')
      .then((res) => setSante(res.data))
      .catch(() => {});
  }, []);

  const assignerAppareil = async () => {
    if (!selectedDevice || !selectedOrgForAssign) return;
    setError('');
    setSuccess('');
    try {
      await api.post(`/devices/${selectedDevice.id}/assign`, {
        organisationId: selectedOrgForAssign,
      });
      setSuccess(
        `Véhicule ${selectedDevice.serial_number} assigné avec succès !`,
      );
      setShowAssignModal(false);
      setSelectedDevice(null);
      setSelectedOrgForAssign('');
      chargerDonnees();
    } catch (err) {
      setError(messageFromError(err, "Échec de l'assignation."));
    }
  };

  const desassignerAppareil = async (device: DeviceCentral) => {
    if (
      !(await confirmer(
        `Désassigner le véhicule ${device.serial_number} de son école ?`,
        { danger: true },
      ))
    )
      return;
    setError('');
    setSuccess('');
    try {
      await api.post(`/devices/${device.id}/release`);
      setSuccess('Véhicule désassigné avec succès !');
      chargerDonnees();
    } catch (err) {
      setError(messageFromError(err, 'Échec de la désassignation.'));
    }
  };

  /** « En ligne » si un signal a été reçu il y a moins de 5 minutes (même seuil que `CronService.handleDeviceHeartbeats`). */
  const estEnLigne = (device: DeviceCentral) => {
    if (!device.last_seen_at) return false;
    return Date.now() - new Date(device.last_seen_at).getTime() < 5 * 60 * 1000;
  };

  const appareilsDisponibles = appareils.filter(
    (d) => !d.assigned_organisation_id,
  );
  const appareilsAssignes = appareils.filter((d) => d.assigned_organisation_id);
  const appareilsEnLigne = appareils.filter(estEnLigne);

  const filteredAssignes = appareilsAssignes.filter(
    (d) =>
      d.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.assigned_organisation_name || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  const formatDerniereSuel = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return <div className="text-center text-navy-300 py-10">Chargement…</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Véhicules GPS</h1>
            <p className="text-navy-300 mt-1">
              Appareils de géolocalisation (GPSWOX…) • Assignation aux écoles
            </p>
          </div>
          <button
            onClick={chargerDonnees}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>

        {/* Panne du sondage GPSWOX */}
        {sante?.enPanne && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-3">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sondage GPSWOX en panne</p>
              <p className="text-sm opacity-80 mt-0.5">
                {sante.echecsConsecutifs} échec(s) consécutif(s)
                {sante.dernierSuccesA
                  ? ` — dernier succès : ${formatDerniereSuel(sante.dernierSuccesA)}`
                  : ' — jamais réussi depuis le démarrage'}
                . Les positions des véhicules ne se mettent plus à jour.
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
            <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-white">
              {appareils.length}
            </div>
            <div className="text-sm text-navy-300 mt-1">
              Total véhicules GPS
            </div>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
            <div className="text-3xl font-bold text-emerald-400">
              {appareilsEnLigne.length}
            </div>
            <div className="text-sm text-emerald-300/70 mt-1">
              En ligne (&lt; 5 min)
            </div>
          </div>
          <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20">
            <div className="text-3xl font-bold text-indigo-400">
              {appareilsAssignes.length}
            </div>
            <div className="text-sm text-indigo-300/70 mt-1">Assignés</div>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
            <div className="text-3xl font-bold text-amber-400">
              {appareilsDisponibles.length}
            </div>
            <div className="text-sm text-amber-300/70 mt-1">Non affectés</div>
          </div>
        </div>

        {/* Véhicules non affectés */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Satellite size={20} className="text-amber-400" />
            Non affectés ({appareilsDisponibles.length})
          </h3>
          {appareilsDisponibles.length === 0 ? (
            <div className="text-center text-navy-400 py-8">
              Aucun véhicule en attente d'affectation. Les appareils
              apparaissent ici automatiquement dès leur première position reçue
              depuis GPSWOX.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appareilsDisponibles.map((d) => (
                <div
                  key={d.id}
                  className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-indigo-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                          estEnLigne(d)
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <MapPin
                          size={18}
                          className={
                            estEnLigne(d) ? 'text-emerald-400' : 'text-navy-400'
                          }
                        />
                      </div>
                      <div>
                        <div className="font-mono text-sm font-semibold text-white">
                          {d.serial_number}
                        </div>
                        <div className="text-xs text-navy-300">
                          {estEnLigne(d) ? 'En ligne' : 'Hors ligne'} •{' '}
                          {formatDerniereSuel(d.last_seen_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDevice(d);
                      setShowAssignModal(true);
                    }}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    <LinkIcon size={14} />
                    Assigner à une école
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions + recherche pour les assignés */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <LinkIcon size={20} className="text-indigo-400" />
            Assignés ({appareilsAssignes.length})
          </h3>
          <div className="relative max-w-xs">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Rechercher…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-9 w-full text-sm"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
              }}
            />
          </div>
        </div>

        {appareilsAssignes.length === 0 ? (
          <div className="text-center text-navy-400 py-8">
            Aucun véhicule assigné pour l'instant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-navy-300">
                  <th className="p-4 font-semibold">Statut</th>
                  <th className="p-4 font-semibold">Identifiant</th>
                  <th className="p-4 font-semibold">Dernière position</th>
                  <th className="p-4 font-semibold">École</th>
                  <th className="p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAssignes.map((d) => (
                  <tr
                    key={d.id}
                    className="text-white hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4">
                      {estEnLigne(d) ? (
                        <span className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                          <CheckCircle2 size={16} /> En ligne
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-navy-400 font-medium text-sm">
                          <AlertCircle size={16} /> Hors ligne
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-sm">{d.serial_number}</td>
                    <td className="p-4 text-sm text-navy-300">
                      {formatDerniereSuel(d.last_seen_at)}
                    </td>
                    <td className="p-4 text-sm">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        <Building2 size={14} />
                        {d.assigned_organisation_name}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => desassignerAppareil(d)}
                        className="text-red-400 hover:text-red-300 flex items-center gap-2 text-sm"
                      >
                        <Unlink size={14} />
                        Désassigner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Assigner véhicule */}
      {showAssignModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">
              Assigner un véhicule
            </h3>
            <p className="text-navy-300 text-sm mb-6">
              Véhicule :{' '}
              <span className="font-mono font-semibold">
                {selectedDevice.serial_number}
              </span>
            </p>
            <div className="mb-6">
              <label className="form-label">École</label>
              <select
                value={selectedOrgForAssign}
                onChange={(e) => setSelectedOrgForAssign(e.target.value)}
                className="form-input"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <option value="" style={{ background: '#1e293b' }}>
                  Sélectionner une école…
                </option>
                {organisations.map((org) => (
                  <option
                    key={org.id}
                    value={org.id}
                    style={{ background: '#1e293b' }}
                  >
                    {org.name} ({org.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-navy-400 mt-2">
                Le directeur de l'école liera ensuite cet appareil à un bus
                précis, depuis « Véhicules » (menu « Périphérique GPS »).
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDevice(null);
                  setSelectedOrgForAssign('');
                }}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={assignerAppareil}
                disabled={!selectedOrgForAssign}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                Assigner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
