import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { GATEWAY_URL } from '../config';
import ChampMotDePasse from '../components/ChampMotDePasse';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${GATEWAY_URL}/api/v1/auth/login`, {
        email: email.trim(),
        password,
      });

      // La School App vérifie que l'utilisateur n'est PAS le Super Admin (optionnel mais recommandé)
      if (response.data.user.role === 'super_admin') {
        throw new Error(
          "Les Super Admins doivent se connecter sur l'Administration Centrale.",
        );
      }

      localStorage.setItem('accessToken', response.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(
        err.message || err.response?.data?.message || 'Erreur de connexion',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center flex-col"
      style={{ minHeight: '100vh', padding: '20px' }}
    >
      <div className="text-center mb-8">
        <h1
          className="text-2xl text-accent"
          style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}
        >
          SMARTBUS
        </h1>
        <p
          className="text-secondary"
          style={{ letterSpacing: '2px', textTransform: 'uppercase' }}
        >
          Portail Établissement
        </p>
      </div>

      <div
        className="glass-panel animate-fade-in w-full"
        style={{ maxWidth: '400px', padding: '2.5rem' }}
      >
        <h2 className="text-xl mb-6 text-center">Connexion</h2>

        {error && (
          <div
            className="mb-4 text-center"
            style={{
              color: 'var(--danger)',
              fontSize: '0.9rem',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '0.5rem',
              borderRadius: '4px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email de l'école</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="direction@ecole.com"
            />
          </div>

          <div className="form-group mb-6">
            <label className="form-label">Mot de passe</label>
            <ChampMotDePasse
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>

          {/* Auto-inscription ouverte : le directeur crée son compte, un Super Admin
              l'active, puis il crée lui-même son école — voir CandidatureDirecteur.tsx. */}
          <div className="text-center mt-6 text-sm text-secondary">
            Votre école n'est pas encore sur SMARTBUS ?<br />
            <Link
              to="/inscription"
              className="text-accent"
              style={{ textDecoration: 'none' }}
            >
              Inscrivez-vous en tant que directeur
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
