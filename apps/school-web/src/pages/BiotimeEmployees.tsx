import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { Plus, Trash2, User, Edit, RefreshCw, Search, Hash } from 'lucide-react';
import { useI18n } from '../i18n';

interface BiotimeEmployee {
  id: number;
  emp_code: string;
  first_name: string;
  last_name: string;
  department?: { id: number; dept_name: string };
  card_no?: string;
  position_name?: string;
  mobile?: string;
  email?: string;
}

const FORM_VIDE = { emp_code: '', first_name: '', last_name: '', department: '', card_no: '' };

export default function BiotimeEmployees() {
  const { t } = useI18n();
  const [employes, setEmployes] = useState<BiotimeEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmp, setEditingEmp] = useState<BiotimeEmployee | null>(null);
  const [formData, setFormData] = useState(FORM_VIDE);
  const [recherche, setRecherche] = useState('');
  const [syncing, setSyncing] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const res = await api.get('/biotime/mon-ecole/biotime-employees');
      setEmployes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        emp_code: formData.emp_code,
        first_name: formData.first_name,
        last_name: formData.last_name,
      };
      if (formData.department) payload.department = Number(formData.department);
      if (formData.card_no) payload.card_no = formData.card_no;

      if (editingEmp) {
        await api.patch(`/biotime/mon-ecole/employees/${editingEmp.id}`, payload);
      } else {
        await api.post('/biotime/mon-ecole/employees', payload);
      }
      fermerModal();
      await synchroniserEtRecharger();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || "Erreur lors de l'opération.";
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleEdit = (emp: BiotimeEmployee) => {
    setEditingEmp(emp);
    setFormData({
      emp_code: emp.emp_code,
      first_name: emp.first_name,
      last_name: emp.last_name,
      department: emp.department?.id?.toString() ?? '',
      card_no: emp.card_no ?? '',
    });
    setShowForm(true);
  };

  const handleDelete = async (emp: BiotimeEmployee) => {
    if (!window.confirm(`${t('action.supprimer')} « ${emp.first_name} ${emp.last_name} » ?`)) return;
    try {
      await api.delete(`/biotime/mon-ecole/employees/${emp.id}`);
      await synchroniserEtRecharger();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Suppression impossible.');
    }
  };

  const synchroniserEtRecharger = async () => {
    setSyncing(true);
    try {
      await api.post('/biotime/mon-ecole/sync-children');
      await new Promise((r) => setTimeout(r, 2000));
    } catch { /* sync is best-effort */ }
    await charger();
    setSyncing(false);
  };

  const fermerModal = () => {
    setShowForm(false);
    setEditingEmp(null);
    setFormData(FORM_VIDE);
  };

  const filtres = employes.filter((e) => {
    const q = recherche.toLowerCase();
    return (
      !q ||
      e.emp_code.toLowerCase().includes(q) ||
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      (e.department?.dept_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('biotime.titre')}</h1>
          <p className="text-slate-500 mt-1">
            {t('biotime.sous_titre')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={synchroniserEtRecharger}
            disabled={syncing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {t('action.actualiser')}
          </button>
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={18} /> {t('action.ajouter')}
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="premium-input-wrapper mb-6" style={{ maxWidth: 400 }}>
        <Search size={16} className="premium-input-icon" />
        <input
          type="text"
          className="premium-input"
          placeholder={t('biotime.rechercher')}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : filtres.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><User size={40} /></div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {recherche ? 'Aucun résultat' : 'Aucun employé'}
          </h3>
          <p className="empty-text">
            {recherche
              ? 'Essayez un autre terme de recherche.'
              : 'Votre serveur BioTime ne contient aucun employé, ou la connexion est inactive.'}
          </p>
        </div>
      ) : (
        <div className="premium-table-wrapper mb-8 mt-4">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom complet</th>
                  <th>Classe</th>
                  <th>Poste</th>
                  <th>Contact</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtres.map((emp) => (
                  <tr key={emp.id} className="premium-row">
                    <td>
                      <span className="flex items-center gap-2 font-mono text-sm">
                        <Hash size={14} className="text-slate-400" />
                        {emp.emp_code}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                          <User size={14} />
                        </div>
                        <span className="font-bold text-slate-800">
                          {emp.first_name} {emp.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="text-sm text-slate-600">
                      {emp.department?.dept_name ?? '—'}
                    </td>
                    <td className="text-sm text-slate-600">
                      {emp.position_name ?? '—'}
                    </td>
                    <td className="text-sm text-slate-500">
                      {emp.mobile || emp.email || '—'}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(emp)} className="btn-icon-primary" title="Modifier">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(emp)} className="btn-icon-danger" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-modal w-full max-w-md animate-fade-in">
            <div className="premium-modal-header">
              <div className="premium-modal-icon"><User size={20} /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {editingEmp ? 'Modifier l\'employé' : 'Nouvel employé'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {editingEmp
                    ? 'Les modifications seront envoyées au serveur BioTime.'
                    : 'L\'employé sera créé directement sur votre serveur BioTime.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                <div className="premium-input-group">
                  <label className="premium-input-label">Matricule (emp_code)</label>
                  <div className="premium-input-wrapper">
                    <Hash size={16} className="premium-input-icon" />
                    <input
                      required
                      type="text"
                      className="premium-input"
                      placeholder="Ex: 10042"
                      value={formData.emp_code}
                      onChange={(e) => setFormData({ ...formData, emp_code: e.target.value })}
                      disabled={!!editingEmp}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="premium-input-group w-full">
                    <label className="premium-input-label">Prénom</label>
                    <div className="premium-input-wrapper">
                      <User size={16} className="premium-input-icon" />
                      <input
                        required
                        type="text"
                        className="premium-input"
                        placeholder="Ex: Aya"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="premium-input-group w-full">
                    <label className="premium-input-label">Nom</label>
                    <div className="premium-input-wrapper">
                      <User size={16} className="premium-input-icon" />
                      <input
                        required
                        type="text"
                        className="premium-input"
                        placeholder="Ex: Konan"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="premium-input-group">
                  <label className="premium-input-label">ID département (classe)</label>
                  <div className="premium-input-wrapper">
                    <Hash size={16} className="premium-input-icon" />
                    <input
                      type="number"
                      className="premium-input"
                      placeholder="Ex: 1"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                </div>

                <div className="premium-input-group mb-0">
                  <label className="premium-input-label">N° de carte (optionnel)</label>
                  <div className="premium-input-wrapper">
                    <Hash size={16} className="premium-input-icon" />
                    <input
                      type="text"
                      className="premium-input"
                      placeholder="Ex: 0001234567"
                      value={formData.card_no}
                      onChange={(e) => setFormData({ ...formData, card_no: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="premium-modal-footer">
                <button type="button" onClick={fermerModal} className="btn btn-secondary flex-1 font-semibold py-1.5 text-sm">
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary flex-1 font-semibold py-1.5 text-sm">
                  {editingEmp ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
