import React, { useRef } from 'react';
import { useSettingsStore, BoardTheme, AccentColor } from '../../stores/chessStore';
import { db, Lesson, LessonProgress, StudyHistory } from '../../database/db';
import { sound } from '../../services/soundService';
import { Download, Upload } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const settings = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportDatabase = async () => {
    sound.playSuccess();
    try {
      const lessons = await db.lessons.toArray();
      const progress = await db.progress.toArray();
      const history = await db.history.toArray();
      const backup = { version: 1, app: 'ChessStudy', exportedAt: Date.now(), data: { lessons, progress, history } };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chess-study-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup failed:', err);
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
        if (backup.app !== 'ChessStudy' || !backup.data) { alert('Invalid backup file.'); return; }
        if (confirm('This will OVERWRITE all current data. Proceed?')) {
          const data = backup.data;
          await db.transaction('rw', [db.lessons, db.progress, db.history], async () => {
            await db.lessons.clear(); await db.progress.clear(); await db.history.clear();
            if (data.lessons) await db.lessons.bulkAdd(data.lessons);
            if (data.progress) await db.progress.bulkAdd(data.progress);
            if (data.history) await db.history.bulkAdd(data.history);
          });
          alert('Imported! Reloading...');
          window.location.reload();
        }
      } catch { alert('Failed to parse backup file.'); }
    };
    reader.readAsText(file);
  };

  const sectionClass = "p-5 bg-l-bg-light border border-white/[0.06] rounded-lg space-y-5";
  const inputClass = "bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 text-l-text transition-colors w-full";

  return (
    <div className="space-y-6 animate-slide-up max-w-4xl w-full">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="text-sm text-l-text-muted mt-1.5">Configure board, audio, and data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Board */}
        <div className={sectionClass}>
          <h3 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider border-b border-white/[0.06] pb-2">Board</h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-l-text-dim">Board Theme</label>
            <select value={settings.boardTheme} onChange={(e) => { sound.playHover(); settings.setBoardTheme(e.target.value as BoardTheme); }}
              className={inputClass}>
              <option value="wood">Wood (Classic)</option>
              <option value="lichess">Lichess Green</option>
              <option value="dark">Dark Gray</option>
              <option value="midnight">Midnight Blue</option>
              <option value="emerald">Emerald</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-l-text-dim">Accent Color</label>
            <div className="grid grid-cols-5 gap-2">
              {(['blue', 'emerald', 'amber', 'rose', 'indigo'] as AccentColor[]).map((col) => {
                const colorMap: Record<string, string> = {
                  blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
                  rose: 'bg-rose-500', indigo: 'bg-indigo-500',
                };
                const isActive = settings.accentColor === col;
                return (
                  <button key={col} onClick={() => { sound.playHover(); settings.setAccentColor(col); }}
                    className={`h-7 rounded-md ${colorMap[col]} flex items-center justify-center border-2 transition-all cursor-pointer ${
                      isActive ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}>
                    {isActive && <span className="text-[10px] font-bold text-white">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-l-text-dim">Board Width</span>
              <span className="text-[10px] font-mono text-l-text-dim">{settings.boardSize}px</span>
            </div>
            <input type="range" min="400" max="800" step="20" value={settings.boardSize}
              onChange={(e) => settings.setBoardSize(parseInt(e.target.value))}
              className="w-full cursor-pointer h-1 bg-l-bg rounded-lg accent-l-accent-blue" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-l-text">Show Coordinates</span>
              <p className="text-[10px] text-l-text-dim">Ranks & files on board edges.</p>
            </div>
            <input type="checkbox" checked={settings.showCoordinates}
              onChange={(e) => { sound.playHover(); settings.setShowCoordinates(e.target.checked); }}
              className="w-4 h-4 rounded border-white/10 accent-l-accent-blue bg-l-bg cursor-pointer" />
          </div>
        </div>

        {/* Behavior & Audio */}
        <div className={sectionClass}>
          <h3 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider border-b border-white/[0.06] pb-2">Behavior & Audio</h3>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-l-text-dim">Volume</span>
              <span className="text-[10px] font-mono text-l-text-dim">{Math.round(settings.soundVolume * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={settings.soundVolume}
              onChange={(e) => settings.setSoundVolume(parseFloat(e.target.value))}
              className="w-full cursor-pointer h-1 bg-l-bg rounded-lg accent-l-accent-blue" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-l-text">Auto Flip Board</span>
              <p className="text-[10px] text-l-text-dim">Rotate on chapter start.</p>
            </div>
            <input type="checkbox" checked={settings.autoFlip}
              onChange={(e) => { sound.playHover(); settings.setAutoFlip(e.target.checked); }}
              className="w-4 h-4 rounded border-white/10 accent-l-accent-blue bg-l-bg cursor-pointer" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-l-text-dim">Animation Speed</label>
            <select value={settings.animationSpeed} onChange={(e) => { sound.playHover(); settings.setAnimationSpeed(e.target.value as any); }}
              className={inputClass}>
              <option value="fast">Fast (80ms)</option>
              <option value="normal">Normal (150ms)</option>
              <option value="slow">Slow (350ms)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-l-text">Reduced Motion</span>
              <p className="text-[10px] text-l-text-dim">Disable piece animations.</p>
            </div>
            <input type="checkbox" checked={settings.reducedMotion}
              onChange={(e) => { sound.playHover(); settings.setReducedMotion(e.target.checked); }}
              className="w-4 h-4 rounded border-white/10 accent-l-accent-blue bg-l-bg cursor-pointer" />
          </div>
        </div>
      </div>

      {/* Database Backup */}
      <div className={sectionClass}>
        <h3 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider border-b border-white/[0.06] pb-2">Data Backup</h3>
        <p className="text-xs text-l-text-dim">All data is stored locally. Use these buttons to export/import.</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={handleExportDatabase}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-l-accent-blue rounded-md hover:brightness-110 cursor-pointer transition-all">
            <Download size={14} />Export
          </button>
          <button onClick={() => { sound.playHover(); fileInputRef.current?.click(); }}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-l-text bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md transition-colors cursor-pointer">
            <Upload size={14} />Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportDatabase} className="hidden" />
        </div>
      </div>
    </div>
  );
};
