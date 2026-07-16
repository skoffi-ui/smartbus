import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Organisation {
  id: string;
  name: string;
  code: string;
  email: string;
  status: string;
  dbProvisioned: boolean;
  createdAt: string;
  subscriptions?: any[];
}

import TopNav from '../components/TopNav';

export default function Dashboard() {
  // ... (le code d'avant ne bouge pas, on remplace juste le render de TopNav)
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrganisations = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get('http://localhost:3000/api/v1/organisations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // L'API renvoie un objet PaginationResponseDto { data, total, page, limit }
      setOrganisations(response.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setError('Erreur lors du chargement des écoles clientes.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganisations();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  };

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const action = currentStatus === 'suspended' ? 'activate' : 'suspend';
      await axios.patch(`http://localhost:3000/api/v1/organisations/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOrganisations(); // Recharge la liste après modification
    } catch (err) {
      alert("Action non autorisée ou erreur serveur.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("⚠️ DANGER : Êtes-vous sûr de vouloir supprimer cette école ? Toutes ses données seront définitivement effacées !")) return;

    try {
      const token = localStorage.getItem('accessToken');
      await axios.delete(`http://localhost:3000/api/v1/organisations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOrganisations();
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Liste des Écoles Clientes</h2>
          <div className="text-sm text-navy-300 font-medium">
            {organisations.length} établissement(s) actif(s)
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4">{error}</div>}

        {loading ? (
          <div className="text-center text-navy-300 py-10">
            Connexion à la base de données centrale...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-navy-300">
                  <th className="p-4 font-semibold">Code</th>
                  <th className="p-4 font-semibold">Nom de l'école</th>
                  <th className="p-4 font-semibold">Email Contact</th>
                  <th className="p-4 font-semibold">Date d'inscription</th>
                  <th className="p-4 font-semibold">Statut</th>
                  <th className="p-4 font-semibold">Abonnement</th>
                  <th className="p-4 font-semibold">BDD Isolée</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {organisations.map((org) => (
                  <tr key={org.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4"><strong className="text-brand-400 font-mono">{org.code}</strong></td>
                    <td className="p-4 font-bold text-white">{org.name}</td>
                    <td className="p-4 text-navy-300">{org.email}</td>
                    <td className="p-4 text-sm text-navy-300">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${org.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          org.status === 'suspended' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                        {org.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      {(() => {
                        const sub = org.subscriptions?.[0];
                        if (!sub) return <span className="text-navy-300 text-sm">Aucun</span>;

                        const isExpired = sub.status === 'expired';
                        const isSuspended = sub.status === 'suspended';
                        const dateFin = new Date(sub.endDate).toLocaleDateString();

                        return (
                          <div className="text-sm">
                            <strong className={isExpired ? 'text-red-400' : isSuspended ? 'text-yellow-400' : 'text-green-400'}>
                              {sub.plan.toUpperCase()}
                            </strong><br />
                            <span className="text-navy-300 text-xs">Fin: {dateFin}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4">
                      {org.dbProvisioned ? <span className="text-green-400 text-sm font-bold"> Créée</span> : <span className="text-yellow-400 text-sm font-bold">⏳ En attente</span>}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleStatusToggle(org.id, org.status)}
                        className="btn-secondary mr-2 text-xs"
                      >
                        {org.status === 'suspended' ? ' Activer' : ' Bloquer'}
                      </button>
                      <button
                        onClick={() => handleDelete(org.id)}
                        className="btn-secondary text-xs text-red-400 border-red-400/20 hover:bg-red-500/10"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}

                {organisations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-navy-300">
                      Aucune école n'a encore été créée sur la plateforme.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
