import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Users from './pages/Users';
import Billing from './pages/Billing';
import Subscriptions from './pages/Subscriptions';
import BiotimeDashboard from './pages/BiotimeDashboard';
import Devices from './pages/Devices';
import BiotimeServeurs from './pages/BiotimeServeurs';
import BiotimeTerminaux from './pages/BiotimeTerminaux';
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
          <Route path="users" element={<Users />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="billing" element={<Billing />} />
          <Route path="biotime" element={<BiotimeDashboard />} />
          <Route path="biotime-serveurs" element={<BiotimeServeurs />} />
          <Route path="biotime-terminaux" element={<BiotimeTerminaux />} />
          <Route path="devices" element={<Devices />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
