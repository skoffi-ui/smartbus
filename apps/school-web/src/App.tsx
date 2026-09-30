import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { rafraichirJetonDedupe } from './services/api';
import { socketService } from './services/socket.service';
import { useI18n } from './i18n';
import Login from './pages/Login';
import CandidatureDirecteur from './pages/CandidatureDirecteur';
import CreerMonEcole from './pages/CreerMonEcole';
import MonEquipe from './pages/MonEquipe';
import DefinirMotDePasse from './pages/DefinirMotDePasse';
import InscriptionDirecteur from './pages/InscriptionDirecteur';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cars from './pages/Cars';
import Drivers from './pages/Drivers';
import Parents from './pages/Parents';
import Children from './pages/Children';
import ChildProfile from './pages/ChildProfile';
import LiveTracking from './pages/LiveTracking';
import AccesBloque from './pages/AccesBloque';

// Composants Transport
import Courses from './pages/Courses';
import TrajetEditor from './pages/TrajetEditor';
import AffectationEleves from './pages/AffectationEleves';
import SuiviMontees from './pages/SuiviMontees';
import CentreAlertes from './pages/CentreAlertes';
import Settings from './pages/Settings';
import Abonnement from './pages/Abonnement';
import {
  aAcces,
  monOrganisationId,
  peutGererEquipe,
  type SchoolFeature,
} from './constants/schoolFeatures';

/**
 * Protège une page : redirige vers /login si non connecté, vers
 * /creer-mon-ecole si le compte est activé mais n'a pas encore d'école
 * (voir CreerMonEcole.tsx — sinon toute la plateforme (menu, dashboard)
 * planterait silencieusement sur des appels qui exigent une école, voir
 * TenantGateService côté gateway), vers /dashboard si l'école n'a pas accès
 * à cette fonctionnalité — sinon affiche la page dans le Layout. Filtrer le
 * menu ne suffit pas : sans ça, une URL tapée directement resterait accessible.
 *
 * `feature` accepte aussi un tableau : une école a alors accès dès qu'elle
 * possède AU MOINS UNE des fonctionnalités listées (logique OR — utilisé par
 * `/centre-alertes`, qui fusionne désormais anomalies critiques et alertes
 * de proximité, deux fonctionnalités qu'une école peut activer indépendamment).
 */
function PageProtegee({
  feature,
  equipe,
  children,
}: {
  feature?: SchoolFeature | SchoolFeature[];
  equipe?: boolean;
  children: ReactNode;
}) {
  const isAuthenticated = !!localStorage.getItem('accessToken');
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!monOrganisationId()) return <Navigate to="/creer-mon-ecole" />;
  if (feature) {
    const features = Array.isArray(feature) ? feature : [feature];
    if (!features.some((f) => aAcces(f))) return <Navigate to="/dashboard" />;
  }
  if (equipe && !peutGererEquipe()) return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
}

/**
 * Un directeur déjà activé mais sans école atterrit ici (voir `PageProtegee`).
 * S'il en a déjà une, inutile d'en recréer une seconde — retour au tableau
 * de bord (voir AuthService.creerMonEcole, qui refuse de toute façon).
 */
function PageCreationEcole() {
  const isAuthenticated = !!localStorage.getItem('accessToken');
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (monOrganisationId()) return <Navigate to="/dashboard" />;
  return <CreerMonEcole />;
}

/**
 * Contrairement à `PageProtegee`, `/login` et `/` étaient jusqu'ici gardés par
 * une simple expression évaluée une fois dans le corps de `App` — figée à la
 * valeur de `isAuthenticated` du dernier rendu de `App`, qui ne se déclenche
 * pas juste parce qu'on navigue vers `/login` (React Router ne remonte que
 * l'élément de route qui devient actif, pas ses ancêtres). Après une
 * déconnexion (localStorage vidé puis `navigate('/login')`, voir Layout.tsx),
 * cette valeur restait donc "connecté" et renvoyait aussitôt vers /dashboard
 * — la page de connexion ne s'affichait qu'après un rechargement complet.
 * En composant à part, React Router le remonte à chaque activation de la
 * route et relit `localStorage` à ce moment précis, comme le fait déjà `PageProtegee`.
 */
function PageConnexion() {
  const isAuthenticated = !!localStorage.getItem('accessToken');
  return !isAuthenticated ? <Login /> : <Navigate to="/dashboard" />;
}

function PageRacine() {
  const isAuthenticated = !!localStorage.getItem('accessToken');
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} />;
}

/** Plein écran, pendant le rafraîchissement du jeton au démarrage (voir App). */
function EcranChargement() {
  const { t } = useI18n();
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}
    >
      {t('chargement')}
    </div>
  );
}

function App() {
  const isAuthenticated = !!localStorage.getItem('accessToken');

  // Rafraîchit le jeton une fois au chargement de l'appli (ouverture/rechargement
  // de la page) AVANT d'afficher le menu ou les routes. `allowedFeatures` est
  // embarqué dans le jeton à son émission (voir AuthService.generateTokens) :
  // sans ce rafraîchissement proactif, le menu et les gardes de route (aAcces,
  // ci-dessous) continueraient d'afficher les anciennes permissions jusqu'à ce
  // qu'un appel API échoue par hasard (401/403) — ce qui n'arrive jamais pour un
  // item de menu, qui ne fait lui-même aucun appel réseau.
  //
  // On BLOQUE le premier rendu jusqu'à la fin de ce rafraîchissement (`pret`)
  // plutôt que d'afficher tout de suite le menu avec les anciennes permissions
  // puis de le corriger juste après : sans ça, l'ancienne fonctionnalité
  // apparaissait un court instant avant de basculer sur la nouvelle — l'effet
  // "clignotant" remonté après test. L'appel est local (gateway sur la même
  // machine) donc l'attente est de l'ordre de quelques dizaines de ms.
  const [pret, setPret] = useState(!isAuthenticated);
  useEffect(() => {
    if (!isAuthenticated) return;
    rafraichirJetonDedupe()
      .catch(() => {
        // Jeton/rafraîchissement invalide : l'intercepteur d'api.ts gérera la
        // déconnexion au premier appel réel qui échouera. On affiche quand
        // même l'appli (avec le jeton existant) plutôt que de bloquer l'écran.
      })
      .finally(() => setPret(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mise à jour en temps réel, sans recharger la page ni sonder le serveur :
  // le socket de suivi live/alertes (déjà ouvert, voir Layout.tsx) reçoit un
  // signal quand le Super Admin modifie les accès de cette école (voir
  // HardwareStreamGateway côté super-app). On rafraîchit le jeton d'ABORD,
  // puis on force le nouveau rendu — jamais l'inverse — pour ne jamais
  // afficher un état intermédiaire incorrect (le clignotement déjà corrigé
  // au chargement de la page ne doit pas revenir ici non plus).
  const [, forcerNouveauRendu] = useState(0);
  useEffect(() => {
    if (!isAuthenticated || !pret) return;
    const socket = socketService.connect();
    const surPermissionsMiseAJour = () => {
      rafraichirJetonDedupe()
        .then(() => forcerNouveauRendu((n) => n + 1))
        .catch(() => {});
    };
    socket.on('permissions_updated', surPermissionsMiseAJour);
    return () => {
      socket.off('permissions_updated', surPermissionsMiseAJour);
    };
  }, [isAuthenticated, pret]);

  if (!pret) {
    return <EcranChargement />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<PageConnexion />} />
        {/* Auto-inscription ouverte d'un directeur — sans invitation, sans école.
            Voir CandidatureDirecteur.tsx. */}
        <Route path="/inscription" element={<CandidatureDirecteur />} />
        {/* Directeur déjà activé mais sans école : il la crée lui-même. */}
        <Route path="/creer-mon-ecole" element={<PageCreationEcole />} />
        {/* Un collaborateur s'inscrit lui-même (prénom, nom, email, mot de passe) à partir
            d'un lien d'invitation généré par un directeur déjà autorisé — voir InscriptionDirecteur.tsx. */}
        <Route path="/rejoindre-ecole" element={<InscriptionDirecteur />} />
        {/* Réinitialisation d'un mot de passe existant, déclenchée par le Super Admin
            (compte déjà créé) — voir DefinirMotDePasse.tsx. */}
        <Route path="/definir-mot-de-passe" element={<DefinirMotDePasse />} />
        {/* École suspendue / non activée / version obsolète : la raison est expliquée ici */}
        <Route path="/acces-bloque" element={<AccesBloque />} />

        {/* Pages protégées : authentification + permission (voir PageProtegee) */}
        <Route
          path="/dashboard"
          element={
            <PageProtegee>
              <Dashboard />
            </PageProtegee>
          }
        />
        <Route
          path="/cars"
          element={
            <PageProtegee feature="cars">
              <Cars />
            </PageProtegee>
          }
        />
        <Route
          path="/drivers"
          element={
            <PageProtegee feature="drivers">
              <Drivers />
            </PageProtegee>
          }
        />
        <Route
          path="/parents"
          element={
            <PageProtegee feature="parents">
              <Parents />
            </PageProtegee>
          }
        />
        <Route
          path="/children"
          element={
            <PageProtegee feature="children">
              <Children />
            </PageProtegee>
          }
        />
        <Route
          path="/children/:id"
          element={
            <PageProtegee feature="children">
              <ChildProfile />
            </PageProtegee>
          }
        />
        <Route
          path="/live"
          element={
            <PageProtegee feature="live">
              <LiveTracking />
            </PageProtegee>
          }
        />

        {/* Transport Scolaire */}
        <Route
          path="/courses"
          element={
            <PageProtegee feature="courses">
              <Courses />
            </PageProtegee>
          }
        />
        <Route
          path="/trajets"
          element={
            <PageProtegee feature="trajets">
              <TrajetEditor />
            </PageProtegee>
          }
        />
        <Route
          path="/affectation"
          element={
            <PageProtegee feature="affectation">
              <AffectationEleves />
            </PageProtegee>
          }
        />
        <Route
          path="/suivi"
          element={
            <PageProtegee feature="suivi">
              <SuiviMontees />
            </PageProtegee>
          }
        />
        <Route
          path="/centre-alertes"
          element={
            <PageProtegee feature={['centre-alertes', 'alertes']}>
              <CentreAlertes />
            </PageProtegee>
          }
        />
        {/* Ancienne URL « Alertes Transport », fusionnée dans /centre-alertes — redirige les liens/marque-pages existants. */}
        <Route
          path="/alertes"
          element={<Navigate to="/centre-alertes" replace />}
        />
        <Route
          path="/settings"
          element={
            <PageProtegee feature="settings">
              <Settings />
            </PageProtegee>
          }
        />
        {/* Sans `feature` : toujours accessible, y compris une école suspendue —
            c'est justement la page qui permet de régulariser (voir AccesBloque.tsx).
            `payments`/`subscriptions` ciblent super-app, jamais bloqués par le
            statut du tenant (voir GatewayService.checkTenant, api-gateway). */}
        <Route
          path="/abonnement"
          element={
            <PageProtegee>
              <Abonnement />
            </PageProtegee>
          }
        />
        {/* Réservée aux écoles autorisées par le Super Admin à créer des comptes
            directeur supplémentaires — voir Layout.tsx, MonEquipe.tsx. */}
        <Route
          path="/mon-equipe"
          element={
            <PageProtegee equipe>
              <MonEquipe />
            </PageProtegee>
          }
        />

        <Route path="/" element={<PageRacine />} />
      </Routes>
    </Router>
  );
}

export default App;
