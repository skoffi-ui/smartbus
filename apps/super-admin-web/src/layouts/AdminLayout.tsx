import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AdminNavbar from '../components/AdminNavbar';

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-navy-900 w-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 ml-64 h-full overflow-y-auto">
        <AdminNavbar />
        <main className="p-4 md:p-8 pt-0 mx-auto max-w-7xl animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
