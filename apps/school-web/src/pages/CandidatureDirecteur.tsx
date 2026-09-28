import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { messageFromError } from '../services/api';
import ChampMotDePasse from '../components/ChampMotDePasse';

/**
 * Auto-inscription ouverte d'un directeur — sans invitation, sans école.
 * Prénom, nom, email et mot de passe sont tous choisis ici, par le directeur
 * lui-même. Le compte est créé en attente : un Super Admin doit l'activer
 * (voir super-admin-web, "Directeurs d'écoles") avant qu'il puisse se
 * connecter et créer lui-même son école (voir CreerMonEcole.tsx).
 */
export default function CandidatureDirecteur() {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');

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
      await api.post('/auth/candidature-directeur', {
        firstName: prenom, lastName: nom, email, password: motDePasse,
      });
      setSucces(true);
    } catch (err) {
      setErreur(messageFromError(err, "Erreur lors de l'inscription."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center flex-col" style={{ minHeight: '100vh', padding: '20px' }}>
      <div className="text-center mb-8">
        <h1 className="text-2xl text-accent" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>SMARTBUS</h1>
        <p className="text-secondary" style={{ letterSpacing: '2px', textTransform: 'uppercase' }}>Portail Établissement</p>
      </div>

      <div className="glass-panel animate-fade-in w-full" style={{ maxWidth: '420px', padding: '2.5rem' }}>
        {succes ? (
          <>
            <h2 className="text-xl mb-4 text-center">Inscription envoyée</h2>
            <p className="text-secondary text-center mb-6" style={{ fontSize: '0.9rem' }}>
              Un administrateur doit activer votre compte avant que vous puissiez vous connecter.
              Vous en serez informé.
            </p>
            <Link to="/login" className="btn btn-secondary w-full" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
              Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-xl mb-2 text-center">Inscription Directeur</h2>
            <p className="text-secondary text-center mb-6" style={{ fontSize: '0.85rem' }}>
              Créez votre compte — vous seul choisissez votre email et votre mot de passe.
            </p>

            {erreur && (
              <div className="mb-4 text-center" style={{ color: 'var(--danger)', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                {erreur}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <input type="text" className="form-input" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Nom</label>
                <input type="text" className="form-input" value={nom} onChange={(e) => setNom(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="direction@ecole.com" />
              </div>

              <div className="form-group">
                <label className="form-label">Mot de passe</label>
                <ChampMotDePasse value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required minLength={8} placeholder="8 caractères minimum" />
              </div>

              <div className="form-group mb-6">
                <label className="form-label">Confirmer le mot de passe</label>
                <ChampMotDePasse value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} placeholder="••••••••" />
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Envoi…' : "S'inscrire"}
              </button>

              <div className="text-center mt-6 text-sm text-secondary">
                Déjà un compte ? <Link to="/login" className="text-accent" style={{ textDecoration: 'none' }}>Se connecter</Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
