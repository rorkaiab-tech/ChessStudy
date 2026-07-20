import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import { sound } from '../../services/soundService';
import {
  LayoutDashboard, BookOpen, AlertTriangle, Zap, Shield,
  GraduationCap, Star, Clock, Search, Settings, PanelLeftClose,
  PanelLeftOpen, Crown,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

export const Layout: React.FC = () => {
  const open = useAppStore((s: any) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s: any) => s.toggleSidebar);
  const location = useLocation();

  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
    { name: 'Openings', path: '/openings', icon: <BookOpen size={18} /> },
    { name: 'Traps', path: '/traps', icon: <AlertTriangle size={18} /> },
    { name: 'Middlegame', path: '/middlegame', icon: <Zap size={18} /> },
    { name: 'Endgames', path: '/endgames', icon: <Shield size={18} /> },
    { name: 'Lessons', path: '/lessons', icon: <GraduationCap size={18} /> },
    { name: 'Favorites', path: '/favorites', icon: <Star size={18} /> },
    { name: 'Review', path: '/review', icon: <Clock size={18} /> },
    { name: 'Search', path: '/search', icon: <Search size={18} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="h-screen w-screen bg-l-bg text-l-text flex overflow-hidden">
      {/* SIDEBAR */}
      <aside
        className={`${
          open ? 'w-56' : 'w-16'
        } bg-l-bg-light border-r border-white/[0.06] transition-all duration-200 ease-in-out flex flex-col z-30 shrink-0`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/[0.06] select-none">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Crown size={20} className="text-l-accent-blue shrink-0" />
            {open && (
              <span className="font-semibold text-sm tracking-wide text-l-text truncate">
                Chess Study
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 custom-scrollbar">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => sound.playHover()}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 group ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-l-text-muted hover:text-l-text hover:bg-white/[0.04]'
                }`}
              >
                <div className={`shrink-0 ${isActive ? 'text-l-accent-blue' : 'text-l-text-dim'}`}>
                  {item.icon}
                </div>
                {open && <span className="truncate">{item.name}</span>}

                {/* Collapsed tooltip */}
                {!open && (
                  <div className="absolute left-14 bg-l-bg-lighter text-l-text text-xs font-medium px-2.5 py-1.5 rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-lg z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={() => { sound.playHover(); toggleSidebar(); }}
            className="w-full flex items-center justify-center py-2 hover:bg-white/[0.04] rounded-md transition-colors duration-150 cursor-pointer text-l-text-dim hover:text-l-text"
          >
            {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 md:px-8 md:py-10 flex flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
