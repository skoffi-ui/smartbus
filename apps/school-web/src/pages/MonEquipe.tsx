import { useEffect, useState } from 'react';
import { Plus, Copy, Check } from 'lucide-react';
import api, { messageFromError } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { monOrganisationId } from '../constants/schoolFeatures';

/**
 * Réservée aux écoles autorisées par le Super Admin à créer des comptes
 * directeur supplémentaires (voir Layout.tsx, `peutGererEquipe`). Le
 * collaborateur invité s'inscrit lui-même (prénom, nom, email et mot de
 * passe) via le lien généré ici — voir InscriptionDirecteur.tsx et
 * AuthService.rejoindreEcole. Supprimer un compte reste une action du Super
 * Admin uniquement (pas de bouton ici) ; bloquer/débloquer est délégué.
 */
export default function MonEquipe() {
  const toast = useToast();
  const confirmer = useConfirm();
  const monId = (() => {
    try {
      const jeton = localStorage.getItem('accessToken');
      return jeton ? JSON.parse(atob(jeton.split('.')[1])).sub : null;
    } catch { return null; }
  })();

  const [equipe, setEquipe] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [invitationEnCours, setInvitationEnCours] = useState(false);
  const [lienInvitation, setLienInvitation] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  const fetchEquipe = async () => {
    try {
      const res = await api.get('/users/mon-equipe');
      setEquipe(res.data);
    } catch (err) {
      setErreur(messageFromError(err, "Impossible de charger l'équipe."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEquipe(); }, []);

  const inviterCollaborateur = async () => {
    setInvitationEnCours(true);
    try {
      const res = await api.post('/users/directors', {});
      setLienInvitation(res.data.invitationUrl);
    } catch (err) {
      toast.error(messageFromError(err, "Erreur lors de l'invitation."));
    } finally {
      setInvitationEnCours(false);
    }
  };

  const toggleStatus = async (id: string, statutActuel: string) => {
    if (statutActuel === 'active') {
      const ok = await confirmer(
        'Ce compte ne pourra plus se connecter tant que vous ne le débloquez pas.',
        { titre: 'Bloquer ce compte ?', danger: true },
      );
      if (!ok) return;
    }
    try {
      await api.patch(`/users/${id}/toggle-status`);
      fetchEquipe();
    } catch (err) {
      toast.error(messageFromError(err, 'Erreur lors du changement de statut.'));
    }
  };

  const copierLien = async () => {
    if (!lienInvitation) return;
    try {
      await navigator.clipboard.writeText(lienInvitation);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error('Copie impossible : sélectionnez et copiez manuellement.');
    }
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement…</div>;
  if (erreur) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>{erreur}</div>;

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ margin: 0 }}>Mon Équipe</h1>
            <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Comptes directeur de votre école.
            </p>
          </div>
          <button onClick={inviterCollaborateur} disabled={invitationEnCours} className="btn btn-primary gap-2 text-sm">
            <Plus size={18} /> {invitationEnCours ? 'Invitation…' : 'Inviter un collaborateur'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <th className="p-3 text-sm text-secondary font-semibold">Directeur</th>
                <th className="p-3 text-sm text-secondary font-semibold">Statut</th>
                <th className="p-3 text-sm text-secondary font-semibold">Inscrit le</th>
                <th className="p-3 text-sm text-secondary font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {equipe.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td className="p-3">
                    <div style={{ fontWeight: 600 }}>
                      {u.firstName} {u.lastName}
                      {u.id === monId && <span className="text-secondary" style={{ fontWeight: 400 }}> (vous)</span>}
                    </div>
                    <div className="text-secondary text-sm">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700,
                      background: u.status === 'active' ? 'var(--success-tint)' : 'var(--danger-tint)',
                      color: u.status === 'active' ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {u.status === 'active' ? 'Actif' : 'Bloqué'}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-secondary">
                    {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-3 text-right">
                    {u.id !== monId && (
                      <button onClick={() => toggleStatus(u.id, u.status)} className="btn btn-secondary text-xs">
                        {u.status === 'active' ? 'Bloquer' : 'Débloquer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {equipe.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Aucun directeur pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lienInvitation && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel p-6 w-full" style={{ maxWidth: '32rem' }}>
            <h3 className="text-xl font-bold mb-1">Lien à transmettre au collaborateur</h3>
            <p className="text-secondary text-sm mb-6">Il choisira lui-même son mot de passe en l'ouvrant. Valable 7 jours.</p>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {lienInvitation}
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1 gap-1.5" onClick={copierLien}>
                {copie ? <Check size={15} /> : <Copy size={15} />} {copie ? 'Copié' : 'Copier'}
              </button>
              <button className="btn btn-primary flex-1" onClick={() => setLienInvitation(null)}>Terminé</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
