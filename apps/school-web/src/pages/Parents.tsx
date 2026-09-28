import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, Edit, Trash2, Phone, Mail, User, KeyRound, Eye, EyeOff, RefreshCw } from 'lucide-react';
import './Parents.css';
import api, { messageFromError } from '../services/api';
import { useI18n } from '../i18n';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

export default function Parents() {
  const { t } = useI18n();
  const toast = useToast();
  const confirmer = useConfirm();
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // PIN démasqués localement, jamais persisté — juste pour l'affichage à la demande.
  const [pinsVisibles, setPinsVisibles] = useState<Record<string, boolean>>({});
  const [regenerationEnCours, setRegenerationEnCours] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingParent, setEditingParent] = useState<any>(null);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '', email: '', pinCode: '' });

  const fetchParents = async () => {
    try {
      const res = await api.get('/parents');
      setParents(res.data);
    } catch (err) {
      toast.error(messageFromError(err, 'Impossible de charger la liste des parents.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // `pinCode` vide ne doit jamais être envoyé : en édition ce serait
    // interprété comme une valeur invalide (le backend exige 4 chiffres
    // s'il est présent) plutôt que « ne pas toucher au PIN actuel » ; à la
    // création, absent signifie « génère-en un » côté serveur.
    const { pinCode, ...payload } = formData;
    const payloadFinal = pinCode ? { ...payload, pinCode } : payload;
    try {
      if (editingParent) {
        await api.patch(`/parents/${editingParent.id}`, payloadFinal);
        toast.success('Parent modifié.');
      } else {
        const { data: cree } = await api.post('/parents', payloadFinal);
        // Le code PIN (généré automatiquement si non saisi) n'est affiché
        // qu'ici, une seule fois à la création — sans ça, aucun moyen simple
        // de le communiquer au parent (il reste consultable ensuite via
        // l'icône œil dans le tableau, mais jamais renvoyé par email/SMS
        // automatiquement : ce n'est pas encore construit).
        toast.success(`Parent créé. Code PIN à communiquer : ${cree.pinCode}`);
      }
      setShowModal(false);
      setEditingParent(null);
      setFormData({ firstName: '', lastName: '', phone: '', email: '', pinCode: '' });
      fetchParents();
    } catch (err) {
      toast.error(messageFromError(err, "Erreur lors de l'enregistrement du parent."));
    }
  };

  const togglePinVisible = (id: string) => {
    setPinsVisibles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const regenererPin = async (parent: any) => {
    if (!(await confirmer(`Régénérer le code PIN de ${parent.firstName} ${parent.lastName} ? L'ancien code ne fonctionnera plus.`))) return;
    setRegenerationEnCours(parent.id);
    try {
      const { data } = await api.post(`/parents/${parent.id}/regenerate-pin`);
      setParents((prev) => prev.map((p) => (p.id === parent.id ? { ...p, pinCode: data.pinCode } : p)));
      setPinsVisibles((prev) => ({ ...prev, [parent.id]: true }));
      toast.success(`Nouveau code PIN : ${data.pinCode} — à communiquer au parent.`);
    } catch (err) {
      toast.error(messageFromError(err, 'Erreur lors de la régénération du code PIN.'));
    } finally {
      setRegenerationEnCours(null);
    }
  };

  const handleEdit = (parent: any) => {
    setEditingParent(parent);
    setFormData({
      firstName: parent.firstName,
      lastName: parent.lastName,
      phone: parent.phone,
      email: parent.email || '',
      pinCode: '', // édité seulement via « Régénérer » dans le tableau, pas ce formulaire
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmer(t('parents.confirmer_suppression'), { danger: true }))) return;
    try {
      await api.delete(`/parents/${id}`);
      fetchParents();
    } catch (err) {
      toast.error(messageFromError(err, 'Erreur lors de la suppression du parent.'));
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des Parents</h1>
          <p className="text-slate-500 mt-1">Gérez les comptes des parents pour l'envoi des notifications.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} /> Ajouter un Parent
        </button>
      </div>

      <div className="premium-table-wrapper mb-8 mt-4">
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th className="w-1/4">Nom</th>
                <th className="w-1/4">Contact</th>
                <th>Code PIN (app parent)</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">Chargement...</td></tr>
              ) : parents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={40} className="opacity-20" />
                      <p>Aucun parent enregistré.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                parents.map(parent => (
                  <tr key={parent.id} className="premium-row">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                          <User size={14} />
                        </div>
                        <div className="font-bold text-slate-800">{parent.firstName} {parent.lastName}</div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        <span className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400"/> 
                          <span className="font-medium text-slate-700">{parent.phone}</span>
                        </span>
                        {parent.email ? (
                          <span className="flex items-center gap-2">
                            <Mail size={14} className="text-slate-400"/> 
                            {parent.email}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-slate-400 italic">
                            <Mail size={14} className="opacity-50"/> 
                            Aucun email
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <KeyRound size={14} className="text-slate-400" />
                        <span className="font-mono font-bold text-slate-700 tracking-wider">
                          {parent.pinCode ? (pinsVisibles[parent.id] ? parent.pinCode : '••••') : '—'}
                        </span>
                        {parent.pinCode && (
                          <button
                            onClick={() => togglePinVisible(parent.id)}
                            className="text-slate-400 hover:text-slate-600"
                            title={pinsVisibles[parent.id] ? 'Masquer' : 'Afficher'}
                          >
                            {pinsVisibles[parent.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        <button
                          onClick={() => regenererPin(parent)}
                          disabled={regenerationEnCours === parent.id}
                          className="text-slate-400 hover:text-indigo-600 disabled:opacity-40"
                          title="Régénérer le code PIN"
                        >
                          <RefreshCw size={14} className={regenerationEnCours === parent.id ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${parent.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${parent.active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {parent.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(parent)} className="btn-icon-primary" title="Modifier">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(parent.id)} className="btn-icon-danger" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'ajout */}
      {/* Rendu dans un portail vers `document.body` : hors de l'arbre de la page,
          aucun ancêtre transformé ne peut servir de référentiel à `position: fixed`.
          La surcouche couvre donc réellement la fenêtre. */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-modal w-full max-w-md animate-fade-in">
            <div className="premium-modal-header">
              <div className="premium-modal-icon">
                <Users size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{editingParent ? 'Modifier le Parent' : 'Nouveau Parent'}</h2>
                <p className="text-xs text-slate-500 mt-1">{editingParent ? 'Modifiez les informations du contact.' : 'Saisissez les informations du contact.'}</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                <div className="premium-input-group">
                  <label className="premium-input-label">Prénom</label>
                  <div className="premium-input-wrapper">
                    <User size={18} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Ex: Jean" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Nom</label>
                  <div className="premium-input-wrapper">
                    <User size={18} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Ex: Dupont" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Téléphone (WhatsApp)</label>
                  <div className="premium-input-wrapper">
                    <Phone size={18} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="+225..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group mb-0">
                  <label className="premium-input-label">Email (Optionnel)</label>
                  <div className="premium-input-wrapper">
                    <Mail size={18} className="premium-input-icon" />
                    <input type="email" className="premium-input" placeholder="jean.dupont@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                </div>

                {!editingParent && (
                  <div className="premium-input-group mb-0 mt-4">
                    <label className="premium-input-label">Code PIN — connexion app parent (Optionnel)</label>
                    <div className="premium-input-wrapper">
                      <KeyRound size={18} className="premium-input-icon" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        className="premium-input"
                        placeholder="Laissez vide pour un code généré automatiquement"
                        value={formData.pinCode}
                        onChange={e => setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="premium-modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setEditingParent(null); }} className="btn btn-secondary flex-1 font-semibold py-1.5 text-sm">Annuler</button>
                <button type="submit" className="btn btn-primary flex-1 font-semibold py-1.5 text-sm">{editingParent ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
