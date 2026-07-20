import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { ChessBoard } from '../components/chess/ChessBoard';

export const Layout: React.FC = () => {
  const open = useAppStore((s) => s.sidebarOpen);
  const nav = ['Dashboard','Openings','Traps','Middlegame','Endgames','Lessons','Favorites','Review','Search','Settings'];
  return (
    <div className="h-screen w-screen bg-[#0f1117] text-white flex overflow-hidden font-sans">
      <aside className={`${open ? 'w-64' : 'w-16'} bg-[#12141a] border-r border-white/5 transition-all duration-300 flex flex-col`}>
        <div className="p-4 font-extrabold text-xl tracking-tight">♘ Chess</div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-1">
          {nav.map((item) => (
            <Link key={item} to={item.toLowerCase()} className="block px-3 py-2 rounded-lg hover:bg-white/5 text-sm font-medium transition">{item}</Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8">
          <Outlet />
          <div className="mt-12">
            <ChessBoard />
          </div>
        </div>
      </main>
    </div>
  );
};
