import { useState, useEffect } from 'react';
import { User, Lock, Bell, Shield, Eye, EyeOff, Save, Globe } from 'lucide-react';
import api, { messageFromError } from '../services/api';
import { useI18n, type Langue } from '../i18n';
import type { FormEvent } from 'react';

interface ProfilUtilisateur {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
}

type Onglet = 'profil' | 'securite' | 'notifications' | 'langue';

export default function Parametres() {
  const { t } = useI18n();
  const [ongletActif, setOngletActif] = useState<Onglet>('profil');
  const [profil, setProfil] = useState<ProfilUtilisateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; texte: string } | null>(null);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');

  const [mdpActuel, setMdpActuel] = useState('');
  const [mdpNouveau, setMdpNouveau] = useState('');
  const [mdpConfirmation, setMdpConfirmation] = useState('');
  const [voirMdpActuel, setVoirMdpActuel] = useState(false);
  const [voirMdpNouveau, setVoirMdpNouveau] = useState(false);

  const [notifServeurDown, setNotifServeurDown] = useState(true);
  const [notifBadgeuseOff, setNotifBadgeuseOff] = useState(true);
  const [notifAboExpire, setNotifAboExpire] = useState(true);
  const [notifNouvelleEcole, setNotifNouvelleEcole] = useState(false);

  useEffect(() => {
    chargerProfil();
  }, []);

  const chargerProfil = async () => {
    try {
      const res = await api.get('/auth/me');
      const u = res.data;
      setProfil(u);
      setPrenom(u.firstName || '');
      setNom(u.lastName || '');
      setEmail(u.email || '');
    } catch (err) {
      afficherMessage('error', messageFromError(err, t('profil.erreur')));
    } finally {
      setChargement(false);
    }
  };

  const afficherMessage = (type: 'success' | 'error', texte: string) => {
    setNotification({ type, texte });
    setTimeout(() => setNotification(null), 4000);
  };

  const sauvegarderProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      await api.patch('/auth/me', { firstName: prenom, lastName: nom, email });
      afficherMessage('success', t('profil.succes'));
      chargerProfil();
    } catch (err) {
      afficherMessage('error', messageFromError(err, t('profil.erreur')));
    } finally {
      setEnCours(false);
    }
  };

  const changerMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mdpNouveau !== mdpConfirmation) {
      afficherMessage('error', t('secu.mdp_pas_identiques'));
      return;
    }
    if (mdpNouveau.length < 8) {
      afficherMessage('error', t('secu.mdp_trop_court'));
      return;
    }
    setEnCours(true);
    try {
      await api.patch('/auth/me/password', { currentPassword: mdpActuel, newPassword: mdpNouveau });
      afficherMessage('success', t('secu.mdp_succes'));
      setMdpActuel('');
      setMdpNouveau('');
      setMdpConfirmation('');
    } catch (err) {
      afficherMessage('error', messageFromError(err, t('secu.mdp_erreur')));
    } finally {
      setEnCours(false);
    }
  };

  const onglets: { cle: Onglet; label: string; icone: typeof User }[] = [
    { cle: 'profil', label: t('param.onglet_profil'), icone: User },
    { cle: 'securite', label: t('param.onglet_securite'), icone: Shield },
    { cle: 'notifications', label: t('param.onglet_notifs'), icone: Bell },
    { cle: 'langue', label: t('param.onglet_langue'), icone: Globe },
  ];

  if (chargement) {
    return <div className="text-center text-navy-300 py-10">{t('param.chargement')}</div>;
  }

  return (
    <div className="animate-fade-in">
      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl text-sm font-medium ${
            notification.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {notification.texte}
        </div>
      )}

      <div className="glass-panel p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{t('param.titre')}</h1>
          <p className="text-navy-300 mt-1">{t('param.sous_titre')}</p>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-8 border-b border-white/10 pb-4">
          {onglets.map((onglet) => {
            const Icone = onglet.icone;
            return (
              <button
                key={onglet.cle}
                onClick={() => setOngletActif(onglet.cle)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  ongletActif === onglet.cle
                    ? 'bg-brand-500/20 text-white'
                    : 'text-navy-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icone size={16} />
                {onglet.label}
              </button>
            );
          })}
        </div>

        {/* Onglet Profil */}
        {ongletActif === 'profil' && (
          <form onSubmit={sauvegarderProfil}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <div className="md:col-span-2 flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-xl font-bold shadow-lg" style={{ color: '#fff' }}>
                  {(prenom[0] || '').toUpperCase()}{(nom[0] || '').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{prenom} {nom}</h2>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300">
                    {profil?.role === 'super_admin' ? t('profil.super_admin') : profil?.role}
                  </span>
                </div>
              </div>

              <div>
                <label className="form-label">{t('profil.prenom')}</label>
                <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} className="form-input" required />
              </div>
              <div>
                <label className="form-label">{t('profil.nom')}</label>
                <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className="form-input" required />
              </div>
              <div className="md:col-span-2">
                <label className="form-label">{t('profil.email')}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" required />
              </div>

              {profil?.lastLoginAt && (
                <div className="md:col-span-2 text-sm text-navy-300">
                  {t('profil.derniere_co')} : {new Date(profil.lastLoginAt).toLocaleString('fr-FR')}
                </div>
              )}

              <div className="md:col-span-2 pt-2">
                <button type="submit" disabled={enCours} className="btn-primary">
                  <Save size={16} className="mr-2" />
                  {enCours ? t('enregistrement') : t('enregistrer')}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Onglet Sécurité */}
        {ongletActif === 'securite' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Lock size={20} />
              {t('secu.titre')}
            </h2>
            <form onSubmit={changerMotDePasse} className="space-y-4">
              <div>
                <label className="form-label">{t('secu.mdp_actuel')}</label>
                <div className="relative">
                  <input
                    type={voirMdpActuel ? 'text' : 'password'}
                    value={mdpActuel}
                    onChange={(e) => setMdpActuel(e.target.value)}
                    className="form-input pr-12"
                    required
                  />
                  <button type="button" onClick={() => setVoirMdpActuel(!voirMdpActuel)} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-white">
                    {voirMdpActuel ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">{t('secu.mdp_nouveau')}</label>
                <div className="relative">
                  <input
                    type={voirMdpNouveau ? 'text' : 'password'}
                    value={mdpNouveau}
                    onChange={(e) => setMdpNouveau(e.target.value)}
                    className="form-input pr-12"
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setVoirMdpNouveau(!voirMdpNouveau)} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-white">
                    {voirMdpNouveau ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">{t('secu.mdp_confirmer')}</label>
                <input type="password" value={mdpConfirmation} onChange={(e) => setMdpConfirmation(e.target.value)} className="form-input" required minLength={8} />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={enCours} className="btn-primary">
                  <Lock size={16} className="mr-2" />
                  {enCours ? t('secu.mdp_modification') : t('secu.mdp_modifier')}
                </button>
              </div>
            </form>

            <div className="mt-10 pt-6 border-t border-white/10">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Shield size={20} />
                {t('secu.sessions')}
              </h2>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{t('secu.session_actuelle')}</p>
                    <p className="text-sm text-navy-300">{t('secu.navigateur')} &mdash; {navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Navigateur'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400">{t('secu.active')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onglet Notifications */}
        {ongletActif === 'notifications' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Bell size={20} />
              {t('notif.titre')}
            </h2>
            <div className="space-y-4">
              <LigneBascule label={t('notif.serveur_down')} description={t('notif.serveur_down_desc')} active={notifServeurDown} surChangement={setNotifServeurDown} />
              <LigneBascule label={t('notif.badgeuse_off')} description={t('notif.badgeuse_off_desc')} active={notifBadgeuseOff} surChangement={setNotifBadgeuseOff} />
              <LigneBascule label={t('notif.abo_expire')} description={t('notif.abo_expire_desc')} active={notifAboExpire} surChangement={setNotifAboExpire} />
              <LigneBascule label={t('notif.nouvelle_ecole')} description={t('notif.nouvelle_ecole_desc')} active={notifNouvelleEcole} surChangement={setNotifNouvelleEcole} />
            </div>
            <div className="pt-6">
              <button onClick={() => afficherMessage('success', t('notif.pref_succes'))} className="btn-primary">
                <Save size={16} className="mr-2" />
                {t('notif.enregistrer_pref')}
              </button>
            </div>
          </div>
        )}

        {/* Onglet Langue */}
        {ongletActif === 'langue' && <OngletLangue afficherMessage={afficherMessage} />}
      </div>
    </div>
  );
}

/* ── Onglet Langue ─────────────────────────────────────────────── */

function OngletLangue({ afficherMessage }: { afficherMessage: (t: 'success' | 'error', m: string) => void }) {
  const { langue, changerLangue, t } = useI18n();

  const selectionner = (l: Langue) => {
    changerLangue(l);
    afficherMessage('success', t('langue.succes'));
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <Globe size={20} />
        {t('langue.titre')}
      </h2>
      <p className="text-navy-300 text-sm mb-6">{t('langue.description')}</p>
      <div className="space-y-3">
        <BoutonLangue code="fr" label={t('langue.francais')} drapeau="🇫🇷" estActif={langue === 'fr'} surClic={() => selectionner('fr')} />
        <BoutonLangue code="en" label={t('langue.anglais')} drapeau="🇬🇧" estActif={langue === 'en'} surClic={() => selectionner('en')} />
      </div>
    </div>
  );
}

function BoutonLangue({ code, label, drapeau, estActif, surClic }: {
  code: string;
  label: string;
  drapeau: string;
  estActif: boolean;
  surClic: () => void;
}) {
  return (
    <button
      onClick={surClic}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
        estActif
          ? 'bg-brand-500/10 border-brand-500/30 text-white'
          : 'bg-white/5 border-white/10 text-navy-300 hover:bg-white/10 hover:text-white'
      }`}
      style={estActif ? { borderColor: 'var(--accent-primary, #4f46e5)', background: 'rgba(79,70,229,0.1)' } : {}}
    >
      <span className="text-2xl">{drapeau}</span>
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-navy-300">{code.toUpperCase()}</p>
      </div>
      {estActif && (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
          ✓
        </span>
      )}
    </button>
  );
}

/* ── Composant Bascule ─────────────────────────────────────────── */

function LigneBascule({ label, description, active, surChangement }: {
  label: string;
  description: string;
  active: boolean;
  surChangement: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div>
        <p className="text-white font-medium">{label}</p>
        <p className="text-sm text-navy-300 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => surChangement(!active)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? 'bg-brand-500' : 'bg-white/20'}`}
        style={active ? { background: 'var(--accent-primary, #4f46e5)' } : {}}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
