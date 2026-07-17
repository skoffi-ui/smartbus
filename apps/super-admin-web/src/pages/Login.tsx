import React, { useState } from 'react';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3000/api/v1/auth/login', {
        email: email.trim(),
        password
      });
      
      const token = response.data.tokens.accessToken;
      // On sauvegarde la clé secrète dans le navigateur
      localStorage.setItem('accessToken', token);
      
      // On recharge la page pour que le routeur nous envoie vers le tableau de bord
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel animate-fade-in w-full" style={{ maxWidth: '400px', padding: '2.5rem' }}>
        <div className="text-center mb-6">
          <h1 className="text-2xl text-accent mb-2">SMARTBUS</h1>
          <p className="text-secondary">Administration Centrale</p>
        </div>

        {error && (
          <div className="mb-4 text-center" style={{ color: 'var(--danger)', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Adresse Email</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="admin@smartbus.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group mb-6">
            <label className="form-label">Mot de passe</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
