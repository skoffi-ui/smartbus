import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Fingerprint, Bell, GraduationCap, User, Save, RefreshCw, CheckCircle, XCircle, Clock, Lock, ChevronRight, Globe, Info, UserPlus } from 'lucide-react';
import api, { messageFromError } from '../services/api';
import ChampMotDePasse from '../components/ChampMotDePasse';
import { useI18n, type Langue } from '../i18n';

type Onglet = 'ecole' | 'biotime' | 'alertes' | 'classes' | 'compte' | 'langue';

export default function Parametres() {
  const { t } = useI18n();
  const [ongletActif, setOngletActif] = useState<Onglet>('ecole');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; texte: string } | null>(null);

  const afficherMessage = (type: 'success' | 'error', texte: string) => {
    setNotification({ type, texte });
    setTimeout(() => setNotification(null), 4000);
  };

  const onglets: { cle: Onglet; label: string; icone: typeof Building2 }[] = [
    { cle: 'ecole', label: t('onglet.ecole'), icone: Building2 },
    { cle: 'biotime', label: t('onglet.biotime'), icone: Fingerprint },
    { cle: 'alertes', label: t('onglet.alertes'), icone: Bell },
    { cle: 'classes', label: t('onglet.classes'), icone: GraduationCap },
    { cle: 'compte', label: t('onglet.compte'), icone: User },
    { cle: 'langue', label: t('onglet.langue'), icone: Globe },
  ];

  return (
    <div className="animate-fade-in">
      {notification && (
        <div style={{
          marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem', fontWeight: 500,
          background: notification.type === 'success' ? 'var(--success-tint)' : 'var(--danger-tint)',
          border: `1px solid ${notification.type === 'success' ? 'var(--success-border-tint)' : 'var(--danger-border-tint)'}`,
          color: notification.type === 'success' ? 'var(--success)' : 'var(--danger)',
        }}>
          {notification.texte}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="text-2xl font-bold">{t('param.titre')}</h1>
        <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>{t('param.sous_titre')}</p>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {onglets.map((onglet) => {
          const Icone = onglet.icone;
          return (
            <button
              key={onglet.cle}
              onClick={() => setOngletActif(onglet.cle)}
              className="glass-panel"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem',
                border: ongletActif === onglet.cle ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                background: ongletActif === onglet.cle ? 'var(--accent-tint)' : 'var(--bg-glass)',
                color: ongletActif === onglet.cle ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: ongletActif === onglet.cle ? 600 : 400,
                fontSize: '0.875rem', cursor: 'pointer', borderRadius: 'var(--radius-pill)',
                whiteSpace: 'nowrap', transition: 'all 0.2s',
              }}
            >
              <Icone size={16} />
              {onglet.label}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {ongletActif === 'ecole' && <OngletEcole afficherMessage={afficherMessage} />}
        {ongletActif === 'biotime' && <OngletBiotime afficherMessage={afficherMessage} />}
        {ongletActif === 'alertes' && <OngletAlertes afficherMessage={afficherMessage} />}
        {ongletActif === 'classes' && <OngletClasses afficherMessage={afficherMessage} />}
        {ongletActif === 'compte' && <OngletCompte afficherMessage={afficherMessage} />}
        {ongletActif === 'langue' && <OngletLangue afficherMessage={afficherMessage} />}
      </div>
    </div>
  );
}

/* ─── Mon École ────────────────────────────────────────────────── */

function OngletEcole({ afficherMessage }: { afficherMessage: (t: 'success' | 'error', m: string) => void }) {
  const { t } = useI18n();
  const [nomEcole, setNomEcole] = useState('');
  const [codeEcole, setCodeEcole] = useState('');
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [emailEcole, setEmailEcole] = useState('');
  const [siteWeb, setSiteWeb] = useState('');
  const [nomDirecteur, setNomDirecteur] = useState('');
  const [emailDirecteur, setEmailDirecteur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    // Nom/email du directeur : déjà connus via le jeton, aucune requête
    // supplémentaire nécessaire pour ces deux champs (lecture seule ici,
    // modifiables depuis l'onglet "Mon compte").
    try {
      const jeton = localStorage.getItem('accessToken');
      if (jeton) {
        const contenu = JSON.parse(atob(jeton.split('.')[1]));
        setNomDirecteur(`${contenu.firstName || ''} ${contenu.lastName || ''}`.trim());
        setEmailDirecteur(contenu.email || '');
      }
    } catch {}

    (async () => {
      try {
        // Les informations de l'école ont déjà été saisies une fois, à la
        // création (`/auth/creer-mon-ecole`) : on les relit ici plutôt que
        // de les redemander, pour permettre uniquement leur modification.
        const res = await api.get('/organisations/mon-ecole');
        const org = res.data;
        setNomEcole(org.name || '');
        setCodeEcole(org.code || '');
        setAdresse(org.address || '');
        setTelephone(org.phone || '');
        setEmailEcole(org.email || '');
        setSiteWeb(org.website || '');
      } catch (err) {
        afficherMessage('error', messageFromError(err, t('ecole.chargement_erreur')));
      } finally {
        setChargement(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      await api.patch('/organisations/mon-ecole', {
        name: nomEcole,
        address: adresse,
        phone: telephone,
        email: emailEcole || undefined,
        website: siteWeb || undefined,
      });
      afficherMessage('success', t('ecole.succes'));
    } catch (err) {
      afficherMessage('error', messageFromError(err, t('ecole.enregistrement_erreur')));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form onSubmit={sauvegarder}>
      <h2 className="text-xl font-bold" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Building2 size={22} style={{ color: 'var(--accent-primary)' }} />
        {t('ecole.titre')}
      </h2>

      {chargement ? (
        <p style={{ color: 'var(--text-secondary)' }}>{t('chargement')}</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '700px' }}>
            <div className="form-group">
              <label className="form-label">{t('ecole.nom')}</label>
              <input className="form-input" value={nomEcole} onChange={(e) => setNomEcole(e.target.value)} placeholder="École Nangui Abrogoua" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('ecole.code')}</label>
              <input className="form-input" value={codeEcole} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">{t('ecole.adresse')}</label>
              <input className="form-input" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Cocody, Abidjan, Côte d'Ivoire" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('ecole.telephone')}</label>
              <input className="form-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+225 07 00 00 00" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('ecole.email')}</label>
              <input className="form-input" type="email" value={emailEcole} onChange={(e) => setEmailEcole(e.target.value)} placeholder="contact@ecole.ci" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">{t('ecole.site_web')}</label>
              <input className="form-input" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} placeholder="https://www.ecole.ci" />
            </div>
          </div>

          <h3 className="font-bold" style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1rem' }}>{t('ecole.responsable')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '700px' }}>
            <div className="form-group">
              <label className="form-label">{t('ecole.nom_directeur')}</label>
              <input className="form-input" value={nomDirecteur} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('ecole.email_directeur')}</label>
              <input className="form-input" type="email" value={emailDirecteur} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{t('ecole.responsable_note')}</p>

          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" disabled={enCours} className="btn btn-primary" style={{ gap: '0.5rem' }}>
              <Save size={16} />
              {enCours ? t('enregistrement') : t('enregistrer')}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

/* ─── BioTime ──────────────────────────────────────────────────── */

function OngletBiotime({ afficherMessage }: { afficherMessage: (t: 'success' | 'error', m: string) => void }) {
  const { t } = useI18n();
  const [statutReSync, setStatutReSync] = useState<'repos' | 'encours' | 'fait'>('repos');
  const [statutSyncClasses, setStatutSyncClasses] = useState<'repos' | 'encours' | 'fait'>('repos');
  const [enfants, setEnfants] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => { chargerEnfants(); }, []);

  const chargerEnfants = async () => {
    try {
      const res = await api.get('/children');
      setEnfants(Array.isArray(res.data) ? res.data : []);
    } catch {} finally { setChargement(false); }
  };

  const nbEnAttente = enfants.filter((e) => e.biotimeSyncStatus === 'PENDING').length;
  const nbEnEchec = enfants.filter((e) => e.biotimeSyncStatus === 'FAILED').length;
  const nbSynchronises = enfants.filter((e) => e.biotimeSyncStatus === 'SYNCED').length;
  const nbNonConfigures = enfants.filter((e) => e.biotimeSyncStatus === 'NOT_CONFIGURED' || !e.biotimeSyncStatus).length;

  const relancerSync = async () => {
    setStatutReSync('encours');
    try {
      const res = await api.post('/children/retry-sync');
      const nb = res.data?.enqueued || 0;
      afficherMessage('success', nb > 0 ? `${nb} ${t('bio.retry_succes')}` : t('bio.retry_aucun'));
      setStatutReSync('fait');
      setTimeout(() => { setStatutReSync('repos'); chargerEnfants(); }, 2000);
    } catch (err) {
      afficherMessage('error', messageFromError(err, t('bio.retry_erreur')));
      setStatutReSync('repos');
    }
  };

  const synchroniserClasses = async () => {
    setStatutSyncClasses('encours');
    try {
      const res = await api.post('/children/sync-classes');
      const nb = res.data?.created?.length || 0;
      afficherMessage('success', nb > 0 ? `${nb} ${t('bio.classes_succes')}` : t('bio.classes_existe'));
      setStatutSyncClasses('fait');
      setTimeout(() => setStatutSyncClasses('repos'), 2000);
    } catch (err) {
      afficherMessage('error', messageFromError(err, t('bio.classes_erreur')));
      setStatutSyncClasses('repos');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Fingerprint size={22} style={{ color: 'var(--accent-primary)' }} />
        {t('bio.titre')}
      </h2>

      {/* Sans élève enregistré, les 4 compteurs sont à 0 par construction —
          on l'explique ici plutôt que de laisser croire à une panne, puisque
          c'est justement ce qui a mené à cette confusion (badgeuses déjà
          assignées à l'école, mais aucun élève encore ajouté). */}
      {!chargement && enfants.length === 0 && (
        <div style={{
          display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem',
          borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', maxWidth: '700px',
          background: 'var(--warning-tint)', border: '1px solid var(--warning-border-tint)',
        }}>
          <Info size={20} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '0.15rem' }} />
          <div>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{t('bio.aucun_eleve_titre')}</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{t('bio.aucun_eleve_desc')}</p>
            <Link to="/children" className="btn btn-primary" style={{ gap: '0.5rem', display: 'inline-flex' }}>
              <UserPlus size={16} />
              {t('bio.aucun_eleve_bouton')}
            </Link>
          </div>
        </div>
      )}

      {/* Cartes statistiques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <CarteStat libelle={t('bio.synchronises')} valeur={nbSynchronises} couleur="var(--success)" fond="var(--success-tint)" icone={<CheckCircle size={20} />} />
        <CarteStat libelle={t('bio.en_attente')} valeur={nbEnAttente} couleur="var(--warning)" fond="var(--warning-tint)" icone={<Clock size={20} />} />
        <CarteStat libelle={t('bio.en_echec')} valeur={nbEnEchec} couleur="var(--danger)" fond="var(--danger-tint)" icone={<XCircle size={20} />} />
        <CarteStat libelle={t('bio.non_configures')} valeur={nbNonConfigures} couleur="var(--text-secondary)" fond="var(--surface-variant)" icone={<Fingerprint size={20} />} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '700px' }}>
        <CarteAction
          titre={t('bio.retry_titre')}
          description={`${nbEnAttente + nbEnEchec} ${t('bio.retry_desc')}`}
          libelBouton={statutReSync === 'encours' ? t('bio.retry_encours') : statutReSync === 'fait' ? t('bio.retry_fait') : t('bio.retry_btn')}
          iconeBouton={statutReSync === 'fait' ? <CheckCircle size={16} /> : <RefreshCw size={16} className={statutReSync === 'encours' ? 'animate-spin' : ''} />}
          surClic={relancerSync}
          desactive={statutReSync !== 'repos' || (nbEnAttente + nbEnEchec === 0)}
          variante="warning"
        />
        <CarteAction
          titre={t('bio.classes_titre')}
          description={t('bio.classes_desc')}
          libelBouton={statutSyncClasses === 'encours' ? t('bio.retry_encours') : statutSyncClasses === 'fait' ? t('bio.retry_fait') : t('bio.classes_btn')}
          iconeBouton={statutSyncClasses === 'fait' ? <CheckCircle size={16} /> : <RefreshCw size={16} className={statutSyncClasses === 'encours' ? 'animate-spin' : ''} />}
          surClic={synchroniserClasses}
          desactive={statutSyncClasses !== 'repos'}
          variante="accent"
        />
      </div>

      {/* Liste des échecs */}
      {nbEnEchec > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 className="font-bold" style={{ marginBottom: '0.75rem' }}>{t('bio.echec_titre')}</h3>
          <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-border-tint)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-variant)' }}>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('bio.col_eleve')}</th>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('bio.col_classe')}</th>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('bio.col_erreur')}</th>
                </tr>
              </thead>
              <tbody>
                {enfants.filter((e) => e.biotimeSyncStatus === 'FAILED').slice(0, 10).map((enfant) => (
                  <tr key={enfant.id} style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}>{enfant.firstName} {enfant.lastName}</td>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{enfant.className || '—'}</td>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--danger)' }}>{enfant.biotimeSyncError || t('bio.erreur_inconnue')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Alertes ──────────────────────────────────────────────────── */

function OngletAlertes({ afficherMessage }: { afficherMessage: (t: 'success' | 'error', m: string) => void }) {
  const { t } = useI18n();
  const [heureDebut, setHeureDebut] = useState('07:00');
  const [heureFin, setHeureFin] = useState('20:00');
  const [rayonProximite, setRayonProximite] = useState(1500);
  const [alerteMontee, setAlerteMontee] = useState(true);
  const [alerteDescente, setAlerteDescente] = useState(true);
  const [alerteRetard, setAlerteRetard] = useState(true);
  const [alerteProximite, setAlerteProximite] = useState(true);
  const [alerteAbsence, setAlerteAbsence] = useState(false);

  return (
    <div>
      <h2 className="text-xl font-bold" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Bell size={22} style={{ color: 'var(--accent-primary)' }} />
        {t('alerte.titre')}
      </h2>

      {/* Plage horaire */}
      <div style={{ marginBottom: '2rem', maxWidth: '700px' }}>
        <h3 className="font-bold" style={{ marginBottom: '0.75rem' }}>{t('alerte.plage_titre')}</h3>
        <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>{t('alerte.plage_desc')}</p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('alerte.debut')}</label>
            <input className="form-input" type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} style={{ width: '150px' }} />
          </div>
          <span className="text-secondary" style={{ marginTop: '1.5rem' }}>{t('alerte.a')}</span>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('alerte.fin')}</label>
            <input className="form-input" type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} style={{ width: '150px' }} />
          </div>
        </div>
      </div>

      {/* Rayon */}
      <div style={{ marginBottom: '2rem', maxWidth: '700px' }}>
        <h3 className="font-bold" style={{ marginBottom: '0.75rem' }}>{t('alerte.rayon_titre')}</h3>
        <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>{t('alerte.rayon_desc')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input type="range" min={500} max={3000} step={100} value={rayonProximite} onChange={(e) => setRayonProximite(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
          <span className="font-bold" style={{ minWidth: '80px', textAlign: 'right' }}>{rayonProximite} m</span>
        </div>
      </div>

      {/* Types */}
      <div style={{ marginBottom: '1.5rem', maxWidth: '700px' }}>
        <h3 className="font-bold" style={{ marginBottom: '0.75rem' }}>{t('alerte.types_titre')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Bascule libelle={t('alerte.montee')} description={t('alerte.montee_desc')} active={alerteMontee} surChangement={setAlerteMontee} />
          <Bascule libelle={t('alerte.descente')} description={t('alerte.descente_desc')} active={alerteDescente} surChangement={setAlerteDescente} />
          <Bascule libelle={t('alerte.retard')} description={t('alerte.retard_desc')} active={alerteRetard} surChangement={setAlerteRetard} />
          <Bascule libelle={t('alerte.proximite')} description={t('alerte.proximite_desc').replace('{rayon}', String(rayonProximite))} active={alerteProximite} surChangement={setAlerteProximite} />
          <Bascule libelle={t('alerte.absence')} description={t('alerte.absence_desc')} active={alerteAbsence} surChangement={setAlerteAbsence} />
        </div>
      </div>

      <button onClick={() => afficherMessage('success', t('alerte.succes'))} className="btn btn-primary" style={{ gap: '0.5rem' }}>
        <Save size={16} />
        {t('enregistrer')}
      </button>
    </div>
  );
}

/* ─── Classes ──────────────────────────────────────────────────── */

function OngletClasses({ afficherMessage }: { afficherMessage: (t: 'success' | 'error', m: string) => void }) {
  const { t } = useI18n();
  const [enfants, setEnfants] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);
  const [arrivee, setArrivee] = useState('07:30');
  const [sortieMatin, setSortieMatin] = useState('12:00');
  const [repriseAm, setRepriseAm] = useState('14:00');
  const [sortieAm, setSortieAm] = useState('17:00');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/children');
        setEnfants(Array.isArray(res.data) ? res.data : []);
      } catch {} finally { setChargement(false); }
    })();
  }, []);

  const carteClasses = new Map<string, number>();
  enfants.forEach((e) => {
    const cls = e.className || t('langue.non_assignee');
    carteClasses.set(cls, (carteClasses.get(cls) || 0) + 1);
  });
  const classes = [...carteClasses.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <h2 className="text-xl font-bold" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <GraduationCap size={22} style={{ color: 'var(--accent-primary)' }} />
        {t('classe.titre')}
      </h2>

      <h3 className="font-bold" style={{ marginBottom: '0.75rem' }}>{t('onglet.classes')} ({classes.length})</h3>
      {chargement ? (
        <p className="text-secondary">{t('chargement')}</p>
      ) : classes.length === 0 ? (
        <p className="text-secondary">{t('classe.aucune')}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
          {classes.map(([nom, nb]) => (
            <div key={nom} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-variant)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-medium">{nom}</span>
              <span style={{ background: 'var(--accent-tint)', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-pill)' }}>
                {nb} {nb > 1 ? t('classe.eleves') : t('classe.eleve')}
              </span>
            </div>
          ))}
        </div>
      )}

      <h3 className="font-bold" style={{ marginBottom: '0.75rem' }}>{t('classe.horaires')}</h3>
      <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>{t('classe.horaires_desc')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', maxWidth: '700px' }}>
        <div className="form-group">
          <label className="form-label">{t('classe.arrivee')}</label>
          <input className="form-input" type="time" value={arrivee} onChange={(e) => setArrivee(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('classe.sortie_matin')}</label>
          <input className="form-input" type="time" value={sortieMatin} onChange={(e) => setSortieMatin(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('classe.reprise_am')}</label>
          <input className="form-input" type="time" value={repriseAm} onChange={(e) => setRepriseAm(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('classe.sortie_am')}</label>
          <input className="form-input" type="time" value={sortieAm} onChange={(e) => setSortieAm(e.target.value)} />
        </div>
      </div>

      <button onClick={() => afficherMessage('success', t('classe.succes'))} className="btn btn-primary" style={{ gap: '0.5rem', marginTop: '1rem' }}>
        <Save size={16} />
        {t('enregistrer')}
      </button>
    </div>
  );
}

/* ─── Mon Compte ───────────────────────────────────────────────── */

function OngletCompte({ afficherMessage }: { afficherMessage: (t: 'success' | 'error', m: string) => void }) {
  const { t } = useI18n();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [mdpActuel, setMdpActuel] = useState('');
  const [mdpNouveau, setMdpNouveau] = useState('');
  const [mdpConfirmation, setMdpConfirmation] = useState('');
  const [abonnement, setAbonnement] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/auth/me');
        setPrenom(res.data.firstName || '');
        setNom(res.data.lastName || '');
        setEmail(res.data.email || '');
      } catch {}
      try {
        const jeton = localStorage.getItem('accessToken');
        if (!jeton) return;
        const contenu = JSON.parse(atob(jeton.split('.')[1]));
        const idOrg = contenu.organisationId || contenu.tenantId;
        if (idOrg) {
          const res = await api.get(`/subscriptions/organisation/${idOrg}`);
          const liste = Array.isArray(res.data) ? res.data : [res.data];
          if (liste.length > 0) setAbonnement(liste[0]);
        }
      } catch {}
    })();
  }, []);

  const sauvegarderProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      await api.patch('/auth/me', { firstName: prenom, lastName: nom, email });
      afficherMessage('success', t('compte.profil_succes'));
    } catch (err) {
      afficherMessage('error', messageFromError(err, t('compte.profil_erreur')));
    } finally { setEnCours(false); }
  };

  const changerMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mdpNouveau !== mdpConfirmation) { afficherMessage('error', t('compte.mdp_pas_identiques')); return; }
    if (mdpNouveau.length < 8) { afficherMessage('error', t('compte.mdp_trop_court')); return; }
    setEnCours(true);
    try {
      await api.patch('/auth/me/password', { currentPassword: mdpActuel, newPassword: mdpNouveau });
      afficherMessage('success', t('compte.mdp_succes'));
      setMdpActuel(''); setMdpNouveau(''); setMdpConfirmation('');
    } catch (err) {
      afficherMessage('error', messageFromError(err, t('compte.mdp_succes')));
    } finally { setEnCours(false); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <User size={22} style={{ color: 'var(--accent-primary)' }} />
        {t('compte.titre')}
      </h2>

      {abonnement && (
        <div style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-tint)', border: '1px solid var(--accent-border-tint)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="font-bold" style={{ color: 'var(--accent-primary)' }}>
              {t('compte.abonnement')} {abonnement.plan?.toUpperCase()}
            </p>
            <p className="text-sm text-secondary">
              {abonnement.status === 'active' ? t('compte.actif') : abonnement.status === 'trial' ? t('compte.essai') : abonnement.status} &mdash; {t('compte.expire_le')} {abonnement.endDate ? new Date(abonnement.endDate).toLocaleDateString('fr-FR') : '—'}
            </p>
          </div>
          <ChevronRight size={20} style={{ color: 'var(--accent-primary)' }} />
        </div>
      )}

      <form onSubmit={sauvegarderProfil}>
        <h3 className="font-bold" style={{ marginBottom: '0.75rem' }}>{t('compte.infos')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '700px' }}>
          <div className="form-group">
            <label className="form-label">{t('compte.prenom')}</label>
            <input className="form-input" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('compte.nom')}</label>
            <input className="form-input" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">{t('compte.email')}</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <button type="submit" disabled={enCours} className="btn btn-primary" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
          <Save size={16} />
          {enCours ? t('enregistrement') : t('enregistrer')}
        </button>
      </form>

      <form onSubmit={changerMotDePasse} style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
        <h3 className="font-bold" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={18} />
          {t('compte.mdp_titre')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px' }}>
          <div className="form-group">
            <label className="form-label">{t('compte.mdp_actuel')}</label>
            <ChampMotDePasse value={mdpActuel} onChange={(e) => setMdpActuel(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('compte.mdp_nouveau')}</label>
            <ChampMotDePasse value={mdpNouveau} onChange={(e) => setMdpNouveau(e.target.value)} required minLength={8} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('compte.mdp_confirmer')}</label>
            <ChampMotDePasse value={mdpConfirmation} onChange={(e) => setMdpConfirmation(e.target.value)} required minLength={8} />
          </div>
        </div>
        <button type="submit" disabled={enCours} className="btn btn-secondary" style={{ gap: '0.5rem', marginTop: '0.75rem' }}>
          <Lock size={16} />
          {t('compte.mdp_btn')}
        </button>
      </form>
    </div>
  );
}

/* ─── Langue ───────────────────────────────────────────────────── */

function OngletLangue({ afficherMessage }: { afficherMessage: (t: 'success' | 'error', m: string) => void }) {
  const { langue, changerLangue, t } = useI18n();

  const selectionner = (l: Langue) => {
    changerLangue(l);
    afficherMessage('success', t('langue.succes'));
  };

  return (
    <div style={{ maxWidth: '500px' }}>
      <h2 className="text-xl font-bold" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Globe size={22} style={{ color: 'var(--accent-primary)' }} />
        {t('langue.titre')}
      </h2>
      <p className="text-secondary text-sm" style={{ marginBottom: '1.5rem' }}>{t('langue.description')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <BoutonLangue code="fr" libelle={t('langue.francais')} drapeau="🇫🇷" estActif={langue === 'fr'} surClic={() => selectionner('fr')} />
        <BoutonLangue code="en" libelle={t('langue.anglais')} drapeau="🇬🇧" estActif={langue === 'en'} surClic={() => selectionner('en')} />
      </div>
    </div>
  );
}

/* ─── Composants partagés ──────────────────────────────────────── */

function BoutonLangue({ code, libelle, drapeau, estActif, surClic }: {
  code: string; libelle: string; drapeau: string; estActif: boolean; surClic: () => void;
}) {
  return (
    <button
      onClick={surClic}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.2s',
        background: estActif ? 'var(--accent-tint)' : 'var(--surface-variant)',
        border: estActif ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
      }}
    >
      <span style={{ fontSize: '1.75rem' }}>{drapeau}</span>
      <div style={{ flex: 1 }}>
        <p className="font-medium">{libelle}</p>
        <p className="text-sm text-secondary">{code.toUpperCase()}</p>
      </div>
      {estActif && (
        <span style={{ background: 'var(--success-tint)', color: 'var(--success)', fontWeight: 700, fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-pill)' }}>✓</span>
      )}
    </button>
  );
}

function CarteStat({ libelle, valeur, couleur, fond, icone }: { libelle: string; valeur: number; couleur: string; fond: string; icone: React.ReactNode }) {
  return (
    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: fond, border: `1px solid ${couleur}22`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ color: couleur }}>{icone}</div>
      <div>
        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: couleur, lineHeight: 1 }}>{valeur}</p>
        <p className="text-sm text-secondary">{libelle}</p>
      </div>
    </div>
  );
}

function CarteAction({ titre, description, libelBouton, iconeBouton, surClic, desactive, variante }: {
  titre: string; description: string; libelBouton: string; iconeBouton: React.ReactNode;
  surClic: () => void; desactive: boolean; variante: 'accent' | 'warning';
}) {
  return (
    <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-variant)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <div style={{ flex: 1 }}>
        <p className="font-bold">{titre}</p>
        <p className="text-sm text-secondary" style={{ marginTop: '0.25rem' }}>{description}</p>
      </div>
      <button onClick={surClic} disabled={desactive} className="btn" style={{
        gap: '0.5rem',
        background: variante === 'accent' ? 'var(--accent-tint)' : 'var(--warning-tint)',
        color: variante === 'accent' ? 'var(--accent-primary)' : 'var(--warning)',
        border: `1px solid ${variante === 'accent' ? 'var(--accent-border-tint)' : 'var(--warning-border-tint)'}`,
        opacity: desactive ? 0.5 : 1, cursor: desactive ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
      }}>
        {iconeBouton}
        {libelBouton}
      </button>
    </div>
  );
}

function Bascule({ libelle, description, active, surChangement }: {
  libelle: string; description: string; active: boolean; surChangement: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-variant)', border: '1px solid var(--glass-border)' }}>
      <div>
        <p className="font-medium">{libelle}</p>
        <p className="text-sm text-secondary" style={{ marginTop: '0.15rem' }}>{description}</p>
      </div>
      <button type="button" onClick={() => surChangement(!active)} style={{ position: 'relative', width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: active ? 'var(--accent-primary)' : 'var(--glass-border)', transition: 'background 0.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: '2px', left: active ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}
