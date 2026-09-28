import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL, messageFromError } from '../services/api';
import ChampMotDePasse from '../components/ChampMotDePasse';

/**
 * Un directeur termine lui-même son inscription à partir d'un lien
 * d'invitation reçu (Super Admin : nouvelle école ou "+ Ajouter un
 * directeur", voir AuthService.registerSchool / UsersService.createDirector).
 * Le jeton ne porte que l'école concernée — prénom, nom, email et mot de
 * passe sont tous choisis ici, par le directeur lui seul. C'est à cet
 * instant que son compte existe (voir AuthService.rejoindreEcole).
 */
export default function InscriptionDirecteur() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');

    if (!token) {
      setErreur("Ce lien est incomplet. Demandez un nouveau lien à votre administrateur.");
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
      // `axios` brut, pas `api` : aucun jeton de session n'existe encore.
      const res = await axios.post(`${API_BASE_URL}/auth/rejoindre-ecole`, {
        token, firstName: prenom, lastName: nom, email, password: motDePasse,
      });
      localStorage.setItem('accessToken', res.data.tokens.accessToken);
      localStorage.setItem('refreshToken', res.data.tokens.refreshToken);
      window.location.href = '/dashboard';
    } catch (err) {
      setErreur(messageFromError(
        err,
        "Ce lien a expiré ou est invalide. Demandez un nouveau lien à votre administrateur.",
      ));
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
        <h2 className="text-xl mb-2 text-center">Créer votre compte directeur</h2>
        <p className="text-secondary text-center mb-6" style={{ fontSize: '0.85rem' }}>
          Vous seul choisissez votre email de connexion et votre mot de passe.
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
            <label className="form-label">Votre email de connexion</label>
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
            {loading ? 'Création du compte…' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
