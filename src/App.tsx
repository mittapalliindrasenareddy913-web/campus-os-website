import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import CampusWelcome from './pages/CampusWelcome';
import CampusLogin from './pages/CampusLogin';
import CampusDashboard from './pages/CampusDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import './index.css';
import { Toaster } from 'sonner';

function AppContent() {
  const auth = useContext(AuthContext);

  if (!auth) return null;
  const { user, loading } = auth;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090514] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/welcome"
        element={!user ? <CampusWelcome /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/login/:portalType"
        element={!user ? <CampusLogin /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/dashboard"
        element={
          user ? (
            <DashboardLayout>
              {user.role === 'super_admin' ? <SuperAdminDashboard /> : <CampusDashboard />}
            </DashboardLayout>
          ) : (
            <Navigate to="/welcome" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/welcome"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          richColors
          expand
          toastOptions={{
            style: {
              background: '#13082b',
              border: '1px solid rgba(124,58,237,0.3)',
              color: '#f0e6ff',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
            },
          }}
        />
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
