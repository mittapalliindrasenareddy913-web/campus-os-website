import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const auth = useContext(AuthContext);

  if (!auth || !auth.user) return null;
  const { user, logout } = auth;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'border-red-500/30 bg-red-950/20 text-red-400';
      case 'principal': return 'border-blue-500/30 bg-blue-950/20 text-blue-400';
      case 'hod': return 'border-purple-500/30 bg-purple-950/20 text-purple-400';
      case 'faculty': return 'border-teal-500/30 bg-teal-950/20 text-teal-400';
      default: return 'border-gray-500/30 bg-gray-900/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col font-sans">
      {/* Top profile navigation bar */}
      <header className="h-16 bg-[#110a24]/80 border-b border-purple-950/30 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-white tracking-widest">CAMPUS <span className="text-gradient">OS</span></span>
          <span className={`text-[10px] font-bold border rounded-full px-2.5 py-0.5 uppercase tracking-wider ${getRoleBadgeColor(user.role)}`}>
            {user.role.replace('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-200">{user.fullName}</p>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{user.collegeName || user.collegeCode || 'Super Cloud Portal'}</p>
          </div>
          
          <button
            onClick={logout}
            className="h-9 px-4 border border-red-500/30 text-red-400 hover:bg-red-950/20 rounded-lg text-xs font-bold transition-all duration-200"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main dashboard viewport */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
