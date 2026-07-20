import React from 'react';
export const SettingsPage: React.FC = () => (
  <div className="p-8 text-white">
    <h1 className="text-3xl font-bold">Settings</h1>
    <div className="mt-6 grid grid-cols-2 gap-4 max-w-xl">
      {['Theme','Board Size','Animation Speed','Sound Volume','Auto Flip','Language','Accent Color'].map(s => (
        <div key={s} className="p-4 rounded-xl bg-white/5 border border-white/10">{s}</div>
      ))}
    </div>
  </div>
);
