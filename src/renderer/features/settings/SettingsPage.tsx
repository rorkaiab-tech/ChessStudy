import React, { useRef } from 'react';
import { useSettingsStore, BoardTheme, AccentColor } from '../../stores/chessStore';
import { db, Lesson, LessonProgress, StudyHistory } from '../../database/db';
import { sound } from '../../services/soundService';

export const SettingsPage: React.FC = () => {
  const settings = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Color theme classes matching settings
  const bgAccent = {
    emerald: 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500/20',
    blue: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500/20',
    amber: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/20',
    rose: 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-500/20',
    indigo: 'bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-500/20',
  }[settings.accentColor];

  const textAccent = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    indigo: 'text-indigo-400',
  }[settings.accentColor];

  const borderHighlight = {
    emerald: 'border-emerald-500/20 focus:border-emerald-500',
    blue: 'border-blue-500/20 focus:border-blue-500',
    amber: 'border-amber-500/20 focus:border-amber-500',
    rose: 'border-rose-500/20 focus:border-rose-500',
    indigo: 'border-indigo-500/20 focus:border-indigo-500',
  }[settings.accentColor];

  // ------------------------------------------
  // Database backup operations
  // ------------------------------------------
  const handleExportDatabase = async () => {
    sound.playSuccess();
    try {
      const lessons = await db.lessons.toArray();
      const progress = await db.progress.toArray();
      const history = await db.history.toArray();

      const backup = {
        version: 1,
        app: 'ChessConstruction',
        exportedAt: Date.now(),
        data: { lessons, progress, history }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chess-construction-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup failed:', err);
      alert('Failed to export local database.');
    }
  };

  const handleImportDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    sound.playSuccess();
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (backup.app !== 'ChessConstruction' || !backup.data) {
          alert('Invalid backup file formatting.');
          return;
        }

        if (confirm('Importing this file will OVERWRITE all current local lessons, streaks, and spaced repetition schedules. Proceed?')) {
          const data = backup.data;
          
          await db.transaction('rw', [db.lessons, db.progress, db.history], async () => {
            // Clear current databases
            await db.lessons.clear();
            await db.progress.clear();
            await db.history.clear();

            // Insert backup records
            if (data.lessons) await db.lessons.bulkAdd(data.lessons);
            if (data.progress) await db.progress.bulkAdd(data.progress);
            if (data.history) await db.history.bulkAdd(data.history);
          });

          sound.playSuccess();
          alert('Database successfully imported! Reloading...');
          window.location.reload();
        }
      } catch (err) {
        console.error('Import failed:', err);
        alert('Failed to parse database file. Check format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl w-full">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-400 mt-2">
          Configure board dimensions, audio volumes, accessibility options, and local backups.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Board Customization */}
        <div className="p-6 bg-[#0f1216] border border-white/5 rounded-2xl space-y-6">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-white/5 pb-2">
            Board Aesthetics
          </h3>

          {/* Board Theme */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400">Board Square Style</label>
            <select
              value={settings.boardTheme}
              onChange={(e) => {
                sound.playHover();
                settings.setBoardTheme(e.target.value as BoardTheme);
              }}
              className="bg-[#090b0e] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-gray-200 transition"
            >
              <option value="lichess">Lichess Classic (Green/Light)</option>
              <option value="wood">Wood Grain (Brown/Tan)</option>
              <option value="dark">Charcoal (Nord/Slate)</option>
              <option value="midnight">Midnight (Deep Blue)</option>
              <option value="emerald">Emerald Forest (Bright Green)</option>
            </select>
          </div>

          {/* Accent Color */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400">Accent Highlight Theme</label>
            <div className="grid grid-cols-5 gap-2">
              {(['indigo', 'emerald', 'blue', 'amber', 'rose'] as AccentColor[]).map((col) => {
                const colorHex = {
                  indigo: 'bg-indigo-500',
                  emerald: 'bg-emerald-500',
                  blue: 'bg-blue-500',
                  amber: 'bg-amber-500',
                  rose: 'bg-rose-500',
                }[col];
                const isActive = settings.accentColor === col;
                return (
                  <button
                    key={col}
                    onClick={() => {
                      sound.playHover();
                      settings.setAccentColor(col);
                    }}
                    className={`h-8 rounded-lg ${colorHex} flex items-center justify-center border-2 transition cursor-pointer ${
                      isActive ? 'border-white scale-[1.08]' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    {isActive && <span className="text-[10px] font-bold text-white">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Board Size */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-gray-400">Max Chessboard Width</span>
              <span className="font-mono text-gray-500">{settings.boardSize}px</span>
            </div>
            <input
              type="range"
              min="400"
              max="800"
              step="20"
              value={settings.boardSize}
              onChange={(e) => settings.setBoardSize(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-[#090b0e] rounded-lg border-none"
            />
          </div>

          {/* Coordinate toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-300">Show Coordinates</span>
              <span className="text-[10px] text-gray-500">Render ranks (1-8) and files (a-h) on board.</span>
            </div>
            <input
              type="checkbox"
              checked={settings.showCoordinates}
              onChange={(e) => {
                sound.playHover();
                settings.setShowCoordinates(e.target.checked);
              }}
              className="w-4 h-4 rounded border-white/10 text-indigo-500 bg-[#090b0e] focus:ring-0"
            />
          </div>
        </div>

        {/* Behavior & Accessibility Options */}
        <div className="p-6 bg-[#0f1216] border border-white/5 rounded-2xl space-y-6">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-white/5 pb-2">
            Behavior & Audio
          </h3>

          {/* Sound volume slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-gray-400">Audio Volume Control</span>
              <span className="font-mono text-gray-500">{Math.round(settings.soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.soundVolume}
              onChange={(e) => settings.setSoundVolume(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-[#090b0e] rounded-lg border-none"
            />
          </div>

          {/* Auto flip */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-300">Auto Flip Board Perspective</span>
              <span className="text-[10px] text-gray-500">Automatically rotates perspective on chapter start.</span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoFlip}
              onChange={(e) => {
                sound.playHover();
                settings.setAutoFlip(e.target.checked);
              }}
              className="w-4 h-4 rounded border-white/10 text-indigo-500 bg-[#090b0e] focus:ring-0"
            />
          </div>

          {/* Animation speed */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400">Piece Sliding Speed</label>
            <select
              value={settings.animationSpeed}
              onChange={(e) => {
                sound.playHover();
                settings.setAnimationSpeed(e.target.value as any);
              }}
              className="bg-[#090b0e] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-gray-200 transition"
            >
              <option value="fast">Fast (80ms - Responsive)</option>
              <option value="normal">Normal (150ms - Smooth)</option>
              <option value="slow">Slow (300ms - Elegant)</option>
            </select>
          </div>

          {/* Reduced motion Accessibility */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-300">Reduced Motion</span>
              <span className="text-[10px] text-gray-500">Deactivates sliding piece animations on move.</span>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => {
                sound.playHover();
                settings.setReducedMotion(e.target.checked);
              }}
              className="w-4 h-4 rounded border-white/10 text-indigo-500 bg-[#090b0e] focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Database Backup Section */}
      <div className="p-6 bg-[#0f1216] border border-white/5 rounded-2xl space-y-6">
        <div>
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-white/5 pb-2">
            Database Backups (Local Offline)
          </h3>
          <p className="text-xs text-gray-500 mt-2">
            Chess Construction runs entirely inside your local sandbox. None of your data is sent online. Use these buttons to manage your data files manually.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          {/* Export */}
          <button
            onClick={handleExportDatabase}
            className={`px-5 py-3 text-xs font-bold text-white rounded-xl shadow-lg cursor-pointer transition ${bgAccent}`}
          >
            📥 Export Database (.json)
          </button>

          {/* Import */}
          <button
            onClick={() => {
              sound.playHover();
              fileInputRef.current?.click();
            }}
            className="px-5 py-3 text-xs font-bold text-gray-300 hover:text-gray-200 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition cursor-pointer"
          >
            📤 Import Backup File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportDatabase}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};
