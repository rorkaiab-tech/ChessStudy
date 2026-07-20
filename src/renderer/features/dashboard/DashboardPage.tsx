import React from 'react';
export const DashboardPage: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
    <div className="grid grid-cols-3 gap-6">
      {['Study Streak', 'Accuracy', 'Review Due'].map(s => (
        <div key={s} className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 shadow-xl backdrop-blur-md">
          <h3 className="text-sm text-gray-400">{s}</h3>
          <p className="text-3xl font-bold mt-2">—</p>
        </div>
      ))}
    </div>
    <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 shadow-xl backdrop-blur-md">
      <h2 className="text-lg font-semibold">Continue Studying</h2>
      <p className="text-sm text-gray-400 mt-2">Select a lesson from the sidebar to begin.</p>
    </div>
  </div>
);
