import React, { useState } from 'react';
import axios from 'axios';

export default function RegisterSchool() {
  const [formData, setFormData] = useState({
    schoolName: '',
    address: '',
    phone: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: '',
  });
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3000/api/v1/auth/register-school', formData);
      
      setStatus({ 
        type: 'success', 
        message: response.data?.message || 'École créée avec succès ! Redirection...' 
      });
      
      // On redirige vers la connexion après 3 secondes
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
      
    } catch (err: any) {
      let errorMessage = err.response?.data?.message || 'Erreur lors de la création de l\'école.';
      if (Array.isArray(errorMessage)) errorMessage = errorMessage.join(', ');
      
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel animate-fade-in w-full" style={{ maxWidth: '650px', padding: '2.5rem' }}>
        <div className="text-center mb-6">
          <h1 className="text-2xl text-accent mb-2">Inscription École</h1>
          <p className="text-secondary">Rejoignez la plateforme SMARTBUS en 1 minute.</p>
        </div>

        {status.message && (
          <div className="mb-6 text-center animate-fade-in" style={{ 
            color: status.type === 'success' ? 'var(--success)' : 'var(--danger)', 
            background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            padding: '1rem', 
            borderRadius: '0.5rem' 
          }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <h3 className="text-xl mb-4 text-secondary" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>1. L'Établissement</h3>
          <div className="flex gap-4 mb-4">
            <div className="form-group w-full">
              <label className="form-label">Nom de l'école</label>
              <input type="text" name="schoolName" className="form-input" placeholder="Lycée Jean Mermoz" required onChange={handleChange} />
            </div>
          </div>
          <div className="flex gap-4 mb-6">
            <div className="form-group w-full">
              <label className="form-label">Adresse (Optionnel)</label>
              <input type="text" name="address" className="form-input" placeholder="Dakar, Sénégal" onChange={handleChange} />
            </div>
            <div className="form-group w-full">
              <label className="form-label">Téléphone (Optionnel)</label>
              <input type="text" name="phone" className="form-input" placeholder="+221..." onChange={handleChange} />
            </div>
          </div>

          <h3 className="text-xl mb-4 text-secondary mt-6" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>2. Le Directeur (Administrateur)</h3>
          <div className="flex gap-4 mb-4">
            <div className="form-group w-full">
              <label className="form-label">Prénom</label>
              <input type="text" name="adminFirstName" className="form-input" placeholder="Jean" required onChange={handleChange} />
            </div>
            <div className="form-group w-full">
              <label className="form-label">Nom</label>
              <input type="text" name="adminLastName" className="form-input" placeholder="Dupont" required onChange={handleChange} />
            </div>
          </div>
          <div className="flex gap-4 mb-6">
            <div className="form-group w-full">
              <label className="form-label">Email de connexion</label>
              <input type="email" name="adminEmail" className="form-input" placeholder="direction@ecole.com" required onChange={handleChange} />
            </div>
            <div className="form-group w-full">
              <label className="form-label">Mot de passe</label>
              <input type="password" name="adminPassword" className="form-input" placeholder="••••••••" minLength={8} required onChange={handleChange} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full mb-4" disabled={loading} style={{ padding: '0.8rem', fontSize: '1rem' }}>
            {loading ? 'Création de la base de données en cours...' : 'Inscrire mon école'}
          </button>
          
          <div className="text-center mt-4">
            <a href="/login" className="text-sm text-accent" style={{ textDecoration: 'none' }}>Déjà inscrit ? Se connecter</a>
          </div>
        </form>
      </div>
    </div>
  );
}
