import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { messageFromError } from '../services/api';
import ChampMotDePasse from '../components/ChampMotDePasse';

/**
 * Page publique où un directeur pose son propre mot de passe — que ce soit
 * pour activer son compte pour la première fois (lien envoyé à la création
 * de son compte par le Super Admin, voir AuthService.registerSchool /
 * UsersService.createDirector) ou pour une réinitialisation qu'il a demandée
 * au Super Admin (voir UsersService.resetPassword). Les deux cas utilisent le
 * même jeton et le même endpoint côté serveur (POST /auth/reset-password) :
 * cette page ne distingue pas les deux, elle affiche juste le résultat.
 */
export default function DefinirMotDePasse() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');

    if (!token) {
      setErreur(
        'Ce lien est incomplet. Demandez un nouveau lien à votre administrateur.',
      );
      return;
    }
    if (motDePasse.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: motDePasse,
      });
      setSucces(true);
    } catch (err) {
      setErreur(
        messageFromError(
          err,
          'Ce lien a expiré ou est invalide. Demandez un nouveau lien à votre administrateur.',
        ),
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
        {succes ? (
          <>
            <h2 className="text-xl mb-4 text-center">Mot de passe défini</h2>
            <p
              className="text-secondary text-center mb-6"
              style={{ fontSize: '0.9rem' }}
            >
              Votre compte est prêt. Vous pouvez maintenant vous connecter.
            </p>
            <button
              className="btn btn-primary w-full"
              onClick={() => navigate('/login')}
            >
              Aller à la connexion
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl mb-2 text-center">
              Définir votre mot de passe
            </h2>
            <p
              className="text-secondary text-center mb-6"
              style={{ fontSize: '0.85rem' }}
            >
              Choisissez le mot de passe de votre compte SMARTBUS. Vous seul le
              connaîtrez.
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
                <label className="form-label">Nouveau mot de passe</label>
                <ChampMotDePasse
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                  minLength={8}
                  placeholder="8 caractères minimum"
                />
              </div>

              <div className="form-group mb-6">
                <label className="form-label">Confirmer le mot de passe</label>
                <ChampMotDePasse
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Enregistrement…' : 'Activer mon compte'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
