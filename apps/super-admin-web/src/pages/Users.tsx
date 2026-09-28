import React, { useState, useEffect } from 'react';
import { Shield, Building2, Copy, Check } from 'lucide-react';

import api, { messageFromError } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

/** Mon propre id, décodé du jeton — pour ne jamais proposer de se bloquer soi-même. */
function monId(): string | null {
  try {
    const jeton = localStorage.getItem('accessToken');
    if (!jeton) return null;
    return JSON.parse(atob(jeton.split('.')[1])).sub || null;
  } catch {
    return null;
  }
}

/** Badge de statut à 3 états : un directeur non encore activé n'est ni "actif" ni "bloqué". */
function BadgeStatut({ statut }: { statut: string }) {
  if (statut === 'pending') {
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">En attente d'activation</span>;
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
      statut === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}>
      {statut === 'active' ? 'Actif' : 'Bloqué'}
    </span>
  );
}

export default function Users() {
  const toast = useToast();
  const confirmer = useConfirm();
  const idCourant = monId();
  const [users, setUsers] = useState<any[]>([]);
  const [organisations, setOrganisations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  // Invitation d'un directeur pour une école existante : aucune identité à
  // saisir ici, voir CreateDirectorDto — le directeur choisit lui-même son
  // prénom, nom, email et mot de passe en s'inscrivant via le lien renvoyé.
  const VIDE_FORMULAIRE_DIRECTEUR = { organisationId: '' };
  const [showAddDirecteur, setShowAddDirecteur] = useState(false);
  const [formulaireDirecteur, setFormulaireDirecteur] = useState(VIDE_FORMULAIRE_DIRECTEUR);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  // Lien à transmettre, qu'il vienne d'une invitation ou d'une réinitialisation
  // — même petite modale de récap pour les deux.
  const [lienActivation, setLienActivation] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err: unknown) {
      setError(messageFromError(err, 'Impossible de charger les utilisateurs.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganisations = async () => {
    try {
      // Le menu déroulant doit lister TOUTES les écoles : `limit: 100` (le
      // maximum accepté par l'API), pas les 10 premières par défaut.
      const res = await api.get('/organisations', { params: { limit: 100 } });
      setOrganisations(res.data.data ?? []);
    } catch {
      // Le menu déroulant sera juste vide ; pas bloquant pour le reste de la page.
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchOrganisations();
  }, []);

  const handleToggleStatus = async (id: string, statutActuel: string) => {
    if (statutActuel === 'active') {
      const ok = await confirmer(
        'Ce compte ne pourra plus se connecter tant que vous ne le débloquez pas.',
        { titre: 'Bloquer ce compte ?', danger: true },
      );
      if (!ok) return;
    }
    try {
      await api.patch(`/users/${id}/toggle-status`);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(messageFromError(err, 'Erreur lors du changement de statut.'));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      setShowAddForm(false);
      setFormData({ firstName: '', lastName: '', email: '', password: '' });
      fetchUsers();
    } catch (err: unknown) {
      toast.error(messageFromError(err, "Erreur lors de la création de l'utilisateur."));
    }
  };

  const handleAddDirecteur = async (e: React.FormEvent) => {
    e.preventDefault();
    setAjoutEnCours(true);
    try {
      const res = await api.post('/users/directors', formulaireDirecteur);
      setShowAddDirecteur(false);
      setFormulaireDirecteur(VIDE_FORMULAIRE_DIRECTEUR);
      setLienActivation(res.data.invitationUrl);
      // Pas de fetchUsers() ici : aucun compte n'existe encore, le directeur
      // n'apparaîtra dans la liste qu'après s'être inscrit lui-même.
    } catch (err: unknown) {
      toast.error(messageFromError(err, "Erreur lors de l'invitation."));
    } finally {
      setAjoutEnCours(false);
    }
  };

  const handleResetPassword = async (id: string) => {
    const ok = await confirmer(
      "Un nouveau lien d'activation sera généré ; l'ancien mot de passe reste valable jusqu'à ce que le directeur utilise ce nouveau lien.",
      { titre: 'Réinitialiser ce mot de passe ?' },
    );
    if (!ok) return;
    try {
      const res = await api.post(`/users/${id}/reset-password`);
      setLienActivation(res.data.activationUrl);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(messageFromError(err, 'Erreur lors de la réinitialisation.'));
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await api.patch(`/users/${id}/activate`);
      toast.success('Compte activé.');
      fetchUsers();
    } catch (err: unknown) {
      toast.error(messageFromError(err, "Erreur lors de l'activation."));
    }
  };

  const handleDeleteDirecteur = async (id: string, nomComplet: string) => {
    const ok = await confirmer(
      `Le compte de ${nomComplet} sera définitivement supprimé. Son école et les autres directeurs ne sont pas affectés.`,
      { titre: 'Supprimer ce compte directeur ?', danger: true },
    );
    if (!ok) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('Compte supprimé.');
      fetchUsers();
    } catch (err: unknown) {
      toast.error(messageFromError(err, 'Erreur lors de la suppression.'));
    }
  };

  const copierLien = async () => {
    if (!lienActivation) return;
    try {
      await navigator.clipboard.writeText(lienActivation);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error('Copie impossible : sélectionnez et copiez manuellement.');
    }
  };

  if (loading) return <div className="text-center text-navy-300 py-10">Chargement de l'équipe...</div>;
  if (error) return <div className="text-red-500 py-10">Erreur : {error}</div>;

  // Deux populations distinctes, jamais mélangées : voir le commentaire sur
  // CreateUserDto pour pourquoi elles ne peuvent pas être gérées pareil.
  const administrateurs = users.filter(u => u.role === 'super_admin');
  const directeurs = users.filter(u => u.role === 'school_admin');

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestion de l'Équipe</h1>
            <p className="text-navy-300 mt-1">Gérez vos administrateurs et visualisez les directeurs d'écoles.</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary"
          >
            {showAddForm ? 'Annuler' : '+ Nouvel Administrateur'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddUser} className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-8 grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Prénom</label>
              <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="form-input" />
            </div>
            <div>
              <label className="form-label">Nom</label>
              <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="form-input" />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="form-input" />
            </div>
            <div>
              <label className="form-label">Mot de passe provisoire</label>
              <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="form-input" />
            </div>
            <div className="col-span-2">
              <p className="text-xs text-navy-400">
                Ce formulaire crée uniquement des comptes <strong className="text-navy-300">Super Administrateur</strong>.
                Les directeurs d'écoles s'inscrivent eux-mêmes (portail établissement) — vous les
                activez ci-dessous, ou en invitez un supplémentaire pour une école déjà existante.
              </p>
            </div>
            <div className="col-span-2 pt-2">
              <button type="submit" className="btn-primary w-full">
                Créer le compte
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Administrateurs : gérés depuis ici (créer/bloquer/débloquer) ────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-500/15 text-purple-300 shrink-0">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Administrateurs ({administrateurs.length})</h2>
            <p className="text-xs text-navy-400">Accès à toute la plateforme — écoles, abonnements, équipe. Gérés ici.</p>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-navy-300">
                <th className="p-4 font-semibold">Utilisateur</th>
                <th className="p-4 font-semibold">Statut</th>
                <th className="p-4 font-semibold">Dernière Connexion</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {administrateurs.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white">
                      {user.firstName} {user.lastName}
                      {user.id === idCourant && <span className="text-navy-400 font-normal"> (vous)</span>}
                    </div>
                    <div className="text-sm text-navy-300">{user.email}</div>
                  </td>
                  <td className="p-4">
                    <BadgeStatut statut={user.status} />
                  </td>
                  <td className="p-4 text-sm text-navy-300">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Jamais'}
                  </td>
                  <td className="p-4 text-right">
                    {user.id !== idCourant && (
                      <button
                        onClick={() => handleToggleStatus(user.id, user.status)}
                        className="btn-secondary text-xs"
                      >
                        {user.status === 'active' ? 'Bloquer' : 'Débloquer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {administrateurs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-navy-300">Aucun administrateur.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Directeurs d'écoles : accès limité à leur propre école, plusieurs par école possible ── */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/15 text-blue-300 shrink-0">
            <Building2 size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Directeurs d'écoles ({directeurs.length})</h2>
            <p className="text-xs text-navy-400">Une école peut avoir plusieurs directeurs. Accès limité à leur propre école.</p>
          </div>
          <button
            onClick={() => setShowAddDirecteur(!showAddDirecteur)}
            className="btn-secondary text-sm shrink-0"
          >
            {showAddDirecteur ? 'Annuler' : '+ Ajouter un directeur'}
          </button>
        </div>

        {showAddDirecteur && (
          <form onSubmit={handleAddDirecteur} className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-6 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">École</label>
              <select
                required
                value={formulaireDirecteur.organisationId}
                onChange={(e) => setFormulaireDirecteur((f) => ({ ...f, organisationId: e.target.value }))}
                className="form-input"
              >
                <option value="" disabled>Sélectionnez une école…</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name} ({org.code})</option>
                ))}
              </select>
              <p className="text-xs text-navy-400 mt-1.5">
                Aucune identité à saisir : un lien d'invitation sera généré, à transmettre au
                futur directeur — il choisit lui-même son prénom, nom, email et mot de passe.
              </p>
            </div>
            <div className="col-span-2 pt-2">
              <button type="submit" className="btn-primary w-full" disabled={ajoutEnCours}>
                {ajoutEnCours ? 'Invitation…' : 'Générer le lien d\'invitation'}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-navy-300">
                <th className="p-4 font-semibold">Directeur</th>
                <th className="p-4 font-semibold">École</th>
                <th className="p-4 font-semibold">Statut</th>
                <th className="p-4 font-semibold">Date d'inscription</th>
                <th className="p-4 font-semibold">Date d'activation</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {directeurs.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white">{user.firstName} {user.lastName}</div>
                    <div className="text-sm text-navy-300">{user.email}</div>
                  </td>
                  <td className="p-4 text-sm text-navy-300">
                    {user.organisation ? (
                      <>
                        <strong className="text-white font-medium">{user.organisation.name}</strong>
                        {' '}<span className="font-mono text-navy-400">({user.organisation.code})</span>
                      </>
                    ) : (
                      <span className="text-navy-400" title="Compte activé, école pas encore créée">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <BadgeStatut statut={user.status} />
                  </td>
                  <td className="p-4 text-sm text-navy-300">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-sm text-navy-300">
                    {user.activatedAt ? new Date(user.activatedAt).toLocaleDateString() : <span className="text-navy-400">—</span>}
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    {user.status === 'pending' && (
                      <button onClick={() => handleActivate(user.id)} className="btn-primary text-xs mr-2">
                        Activer
                      </button>
                    )}
                    {user.status !== 'pending' && (
                      <button onClick={() => handleToggleStatus(user.id, user.status)} className="btn-secondary text-xs mr-2">
                        {user.status === 'active' ? 'Bloquer' : 'Débloquer'}
                      </button>
                    )}
                    <button onClick={() => handleResetPassword(user.id)} className="btn-secondary text-xs mr-2">
                      Réinitialiser
                    </button>
                    <button
                      onClick={() => handleDeleteDirecteur(user.id, `${user.firstName} ${user.lastName}`)}
                      className="btn-secondary text-xs text-red-400 border-red-400/20 hover:bg-red-500/10"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {directeurs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-navy-300">Aucun directeur d'école.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Récap du lien à transmettre — commun à "Ajouter un directeur" et "Réinitialiser",
          affiché une seule fois : le serveur ne renvoie jamais le mot de passe lui-même. */}
      {lienActivation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-white mb-1">Lien à transmettre au directeur</h3>
            <p className="text-navy-300 text-sm mb-6">
              Il choisira lui-même son mot de passe en l'ouvrant. Valable 7 jours.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-sm break-all" style={{ color: 'var(--text-primary)' }}>
              <strong className="font-mono text-xs">{lienActivation}</strong>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1 flex items-center justify-center gap-1.5" onClick={copierLien}>
                {copie ? <Check size={15} /> : <Copy size={15} />} {copie ? 'Copié' : 'Copier'}
              </button>
              <button className="btn-primary flex-1" onClick={() => setLienActivation(null)}>
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
