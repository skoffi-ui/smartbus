import React, { useState, useEffect } from 'react';

import TopNav from '../components/TopNav';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'super_admin',
    password: ''
  });
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3000/api/v1/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur réseau');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (id: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`http://localhost:3000/api/v1/users/${id}/toggle-status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (err) {
      alert('Erreur lors du changement de statut');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3000/api/v1/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Erreur lors de la création');
      setShowAddForm(false);
      setFormData({ firstName: '', lastName: '', email: '', role: 'super_admin', password: '' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="text-center text-navy-300 py-10">Chargement de l'équipe...</div>;
  if (error) return <div className="text-red-500 py-10">Erreur : {error}</div>;

  return (
    <div className="animate-fade-in">
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
            <div>
              <label className="form-label">Rôle</label>
              <select 
                value={formData.role} 
                onChange={e => setFormData({...formData, role: e.target.value})}
                className="form-input"
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
              >
                <option value="super_admin" style={{ background: '#1e293b' }}>Super Administrateur</option>
                <option value="school_admin" style={{ background: '#1e293b' }}>Directeur (École)</option>
              </select>
            </div>
            <div className="col-span-2 pt-2">
              <button type="submit" className="btn-primary w-full">
                Créer le compte
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-navy-300">
                <th className="p-4 font-semibold">Utilisateur</th>
                <th className="p-4 font-semibold">Rôle</th>
                <th className="p-4 font-semibold">Statut</th>
                <th className="p-4 font-semibold">Dernière Connexion</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white">{user.firstName} {user.lastName}</div>
                    <div className="text-sm text-navy-300">{user.email}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      user.role === 'super_admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      user.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {user.status === 'active' ? 'Actif' : 'Bloqué'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-navy-300">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Jamais'}
                  </td>
                  <td className="p-4 text-right">
                    {user.role !== 'school_admin' && (
                      <button 
                        onClick={() => handleToggleStatus(user.id)}
                        className="btn-secondary text-xs"
                      >
                        {user.status === 'active' ? 'Bloquer' : 'Débloquer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-navy-300">Aucun utilisateur trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
