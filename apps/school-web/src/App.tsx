import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import RegisterSchool from './pages/RegisterSchool';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cars from './pages/Cars';
import Drivers from './pages/Drivers';
import Parents from './pages/Parents';
import Children from './pages/Children';
import ChildProfile from './pages/ChildProfile';
import LiveTracking from './pages/LiveTracking';
import CheckoutSandbox from './pages/CheckoutSandbox';
import AccesBloque from './pages/AccesBloque';

// Nouveaux composants Transport
import Courses from './pages/Courses';
import Trajets from './pages/Trajets';
import PointsRecuperation from './pages/PointsRecuperation';
import AffectationEleves from './pages/AffectationEleves';
import SuiviMontees from './pages/SuiviMontees';
import AlertesTransport from './pages/AlertesTransport';
import CentreAlertes from './pages/CentreAlertes';

function App() {
  // Vérifie si un jeton est présent dans le navigateur
  const isAuthenticated = !!localStorage.getItem('accessToken');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!isAuthenticated ? <RegisterSchool /> : <Navigate to="/dashboard" />} />
        <Route path="/checkout-sandbox" element={<CheckoutSandbox />} />
        {/* École suspendue / non activée / version obsolète : la raison est expliquée ici */}
        <Route path="/acces-bloque" element={<AccesBloque />} />
        
        {/* Pages protégées avec le Layout */}
        <Route path="/dashboard" element={isAuthenticated ? <Layout><Dashboard /></Layout> : <Navigate to="/login" />} />
        <Route path="/cars" element={isAuthenticated ? <Layout><Cars /></Layout> : <Navigate to="/login" />} />
        <Route path="/drivers" element={isAuthenticated ? <Layout><Drivers /></Layout> : <Navigate to="/login" />} />
        <Route path="/parents" element={isAuthenticated ? <Layout><Parents /></Layout> : <Navigate to="/login" />} />
        <Route path="/children" element={isAuthenticated ? <Layout><Children /></Layout> : <Navigate to="/login" />} />
        <Route path="/children/:id" element={isAuthenticated ? <Layout><ChildProfile /></Layout> : <Navigate to="/login" />} />
        <Route path="/live" element={isAuthenticated ? <Layout><LiveTracking /></Layout> : <Navigate to="/login" />} />
        
        {/* Nouvelles pages Transport Scolaire */}
        <Route path="/courses" element={isAuthenticated ? <Layout><Courses /></Layout> : <Navigate to="/login" />} />
        <Route path="/trajets" element={isAuthenticated ? <Layout><Trajets /></Layout> : <Navigate to="/login" />} />
        <Route path="/points" element={isAuthenticated ? <Layout><PointsRecuperation /></Layout> : <Navigate to="/login" />} />
        <Route path="/affectation" element={isAuthenticated ? <Layout><AffectationEleves /></Layout> : <Navigate to="/login" />} />
        <Route path="/suivi" element={isAuthenticated ? <Layout><SuiviMontees /></Layout> : <Navigate to="/login" />} />
        <Route path="/historique" element={isAuthenticated ? <Layout><SuiviMontees /></Layout> : <Navigate to="/login" />} />
        <Route path="/alertes" element={isAuthenticated ? <Layout><AlertesTransport /></Layout> : <Navigate to="/login" />} />
        <Route path="/centre-alertes" element={isAuthenticated ? <Layout><CentreAlertes /></Layout> : <Navigate to="/login" />} />
        
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
