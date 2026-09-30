import React, { useState } from 'react';
import api, { messageFromError } from '../services/api';

/**
 * Un directeur déjà activé par le Super Admin, mais sans école (voir
 * PageProtegee/App.tsx qui redirige ici tant que `organisationId` est vide),
 * crée lui-même son établissement. Une fois créé, de nouveaux jetons (avec
 * l'`organisationId`) remplacent les anciens et l'app redirige vers le
 * tableau de bord.
 */
export default function CreerMonEcole() {
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setLoading(true);
    try {
      const res = await api.post('/auth/creer-mon-ecole', {
        schoolName: nom,
        address: adresse || undefined,
        phone: telephone || undefined,
      });
      localStorage.setItem('accessToken', res.data.tokens.accessToken);
      localStorage.setItem('refreshToken', res.data.tokens.refreshToken);
      window.location.href = '/dashboard';
    } catch (err) {
      setErreur(
        messageFromError(err, "Erreur lors de la création de l'école."),
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
        style={{ maxWidth: '420px', padding: '2.5rem' }}
      >
        <h2 className="text-xl mb-2 text-center">Créer mon école</h2>
        <p
          className="text-secondary text-center mb-6"
          style={{ fontSize: '0.85rem' }}
        >
          Votre compte est activé — renseignez maintenant votre établissement.
        </p>

        {erreur && (
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
            {erreur}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nom de l'école</label>
            <input
              type="text"
              className="form-input"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              placeholder="Lycée Saint-Exupéry"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Adresse (optionnel)</label>
            <input
              type="text"
              className="form-input"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
            />
          </div>

          <div className="form-group mb-6">
            <label className="form-label">Téléphone (optionnel)</label>
            <input
              type="text"
              className="form-input"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Création…' : "Créer l'école"}
          </button>
        </form>
      </div>
    </div>
  );
}
