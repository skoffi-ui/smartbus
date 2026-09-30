import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Ecoles from './pages/Ecoles';
import Login from './pages/Login';
import Users from './pages/Users';
import Subscriptions from './pages/Subscriptions';
import BiotimeGestionCentrale from './pages/BiotimeGestionCentrale';
import VehiculesGps from './pages/VehiculesGps';
import Settings from './pages/Settings';
import AdminLayout from './layouts/AdminLayout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ecoles" element={<Ecoles />} />
          <Route path="users" element={<Users />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="biotime-centrale" element={<BiotimeGestionCentrale />} />
          <Route path="vehicules-gps" element={<VehiculesGps />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
