import React, { useEffect, useState } from 'react';
import { db, Lesson, LessonProgress, StudyHistory } from '../../database/db';
import { useChessStore, useSettingsStore } from '../../stores/chessStore';
import { Link, useNavigate } from 'react-router-dom';
import { sound } from '../../services/soundService';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);
  const { accentColor } = useSettingsStore();

  const [streak, setStreak] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [recentLessons, setRecentLessons] = useState<(Lesson & { progress?: LessonProgress })[]>([]);
  const [weeklyHistory, setWeeklyHistory] = useState<{ day: string; count: number }[]>([]);
  const [favOpening, setFavOpening] = useState<Lesson | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      // 1. Calculate Streak
      const history = await db.history.toArray();
      const streakVal = calculateStreak(history);
      setStreak(streakVal);

      // 2. Calculate Accuracy
      let totalMoves = 0;
      let totalCorrect = 0;
      history.forEach((h) => {
        totalMoves += h.movesPlayed;
        totalCorrect += h.correctMoves;
      });
      const acc = totalMoves > 0 ? Math.round((totalCorrect / totalMoves) * 100) : 0;
      setAccuracy(acc);

      // 3. Count Review Due
      const now = Date.now();
      const dueCount = await db.progress.filter((p) => p.dueDate <= now && p.intervalDays > 0).count();
      setReviewCount(dueCount);

      // 4. Fetch Recent Lessons
      const progressList = await db.progress
        .filter((p) => p.lastStudiedAt > 0)
        .sortBy('lastStudiedAt');
      
      const recents: (Lesson & { progress?: LessonProgress })[] = [];
      // Take the latest 3
      const latestProgress = progressList.reverse().slice(0, 3);
      for (const p of latestProgress) {
        const l = await db.lessons.get(p.lessonId);
        if (l) {
          recents.push({ ...l, progress: p });
        }
      }
      setRecentLessons(recents);

      // 5. Fetch Favorite Opening
      const fav = await db.lessons
        .where('category')
        .equals('Openings')
        .and((l) => l.isFavorite === 1)
        .first();
      setFavOpening(fav || null);

      // 6. Weekly Progress (last 7 days)
      const weekData = getLast7DaysProgress(history);
      setWeeklyHistory(weekData);
    };

    loadDashboardData().catch((err) => console.error('Dashboard load failed:', err));
  }, []);

  const calculateStreak = (history: StudyHistory[]): number => {
    if (history.length === 0) return 0;
    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
    
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If last studied is not today or yesterday, streak is broken
    const lastDate = sorted[0].date;
    if (lastDate !== todayStr && lastDate !== yesterdayStr) {
      return 0;
    }

    let currentStreak = 0;
    let checkDate = new Date(lastDate === todayStr ? todayStr : yesterdayStr);

    for (let i = 0; i < 30; i++) {
      const checkStr = checkDate.toISOString().split('T')[0];
      const found = sorted.some((h) => h.date === checkStr && h.movesPlayed > 0);
      if (found) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return currentStreak;
  };

  const getLast7DaysProgress = (history: StudyHistory[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result: { day: string; count: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hEntry = history.find((h) => h.date === dateStr);
      result.push({
        day: days[d.getDay()],
        count: hEntry ? hEntry.movesPlayed : 0,
      });
    }
    return result;
  };

  // Color theme helpers
  const borderHighlight = {
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
    blue: 'border-blue-500/20 hover:border-blue-500/40',
    amber: 'border-amber-500/20 hover:border-amber-500/40',
    rose: 'border-rose-500/20 hover:border-rose-500/40',
    indigo: 'border-indigo-500/20 hover:border-indigo-500/40',
  }[accentColor];

  const textAccent = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    indigo: 'text-indigo-400',
  }[accentColor];

  const bgAccent = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
  }[accentColor];

  const handleLessonClick = (lesson: Lesson) => {
    sound.playSuccess();
    setActiveLesson(lesson);
    navigate(`/lessons/${lesson.id}`);
  };

  const maxWeeklyCount = Math.max(...weeklyHistory.map((w) => w.count), 1);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Dashboard Welcome Header */}
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Welcome Back, Scholar</h1>
        <p className="text-sm text-gray-400 mt-2">
          Your offline chess study repository is ready. Review scheduled cards or write new theory.
        </p>
      </div>

      {/* 1. Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Streak */}
        <div className={`p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.01] border ${borderHighlight} shadow-xl backdrop-blur-md transition duration-200 group`}>
          <div className="flex justify-between items-start">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Study Streak</h3>
            <span className="text-xl">🔥</span>
          </div>
          <p className="text-4xl font-extrabold mt-3 flex items-baseline gap-2">
            {streak} <span className="text-xs font-medium text-gray-500">Days</span>
          </p>
          <div className="mt-2 text-xs text-gray-500">
            {streak > 0 ? 'Keep it going! Play daily moves.' : 'Study today to start a streak!'}
          </div>
        </div>

        {/* Accuracy */}
        <div className={`p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.01] border ${borderHighlight} shadow-xl backdrop-blur-md transition duration-200 group`}>
          <div className="flex justify-between items-start">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tactical Accuracy</h3>
            <span className="text-xl">🎯</span>
          </div>
          <p className="text-4xl font-extrabold mt-3 flex items-baseline gap-2">
            {accuracy}%
          </p>
          <div className="mt-2 text-xs text-gray-500">
            Accuracy across all interactive quizzes.
          </div>
        </div>

        {/* Review Due */}
        <div className={`p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.01] border ${borderHighlight} shadow-xl backdrop-blur-md transition duration-200 group`}>
          <div className="flex justify-between items-start">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Spaced Review</h3>
            <span className="text-xl">⚡</span>
          </div>
          <p className="text-4xl font-extrabold mt-3 flex items-baseline gap-2">
            {reviewCount} <span className="text-xs font-medium text-gray-500">Scheduled</span>
          </p>
          <div className="mt-2 text-xs text-gray-500">
            {reviewCount > 0 ? (
              <Link to="/review" onClick={() => sound.playHover()} className={`${textAccent} font-semibold hover:underline`}>
                Start Review Session &rarr;
              </Link>
            ) : (
              'All caught up for today!'
            )}
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Weekly Progress and Quick study details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Activity chart (left 2 cols) */}
        <div className={`lg:col-span-2 p-6 rounded-2xl bg-[#0f1216] border border-white/5 shadow-xl flex flex-col justify-between`}>
          <div>
            <h2 className="text-lg font-bold text-gray-200">Weekly Progress</h2>
            <p className="text-xs text-gray-400">Total training moves input per day.</p>
          </div>

          <div className="h-40 flex items-end justify-between gap-4 mt-6 px-2">
            {weeklyHistory.map((item, idx) => {
              const pct = (item.count / maxWeeklyCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-help">
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip */}
                    <span className="absolute -top-8 bg-gray-950 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                      {item.count} moves
                    </span>
                    {/* Graph bar */}
                    <div
                      style={{ height: `${Math.max(pct, 6)}%` }}
                      className={`w-8 rounded-t-lg transition-all duration-500 ${bgAccent} ${
                        item.count > 0 ? 'opacity-80 group-hover:opacity-100' : 'opacity-15'
                      }`}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions & Favorite openings */}
        <div className="p-6 rounded-2xl bg-[#0f1216] border border-white/5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-200">Personal Highlight</h2>
            <p className="text-xs text-gray-400">Quick-start recommended topics.</p>
          </div>

          <div className="my-6 space-y-4 flex-1 flex flex-col justify-center">
            {favOpening ? (
              <div
                onClick={() => handleLessonClick(favOpening)}
                className={`p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.05] cursor-pointer transition`}
              >
                <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Favorite Opening</div>
                <div className="text-sm font-semibold text-gray-200 mt-1 truncate">{favOpening.name}</div>
                <div className="text-xs text-gray-500 mt-1">{favOpening.difficulty} &bull; {favOpening.tags[0]}</div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic p-4 border border-dashed border-white/10 rounded-xl text-center">
                Favorite an Opening lesson to show it here.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  sound.playSuccess();
                  navigate('/search');
                }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-semibold text-gray-300 transition cursor-pointer text-center"
              >
                Browse Lessons
              </button>
              <button
                onClick={() => {
                  sound.playSuccess();
                  navigate('/settings');
                }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-semibold text-gray-300 transition cursor-pointer text-center"
              >
                Set Themes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Row: Recent Lessons */}
      <div className="p-6 rounded-2xl bg-[#0f1216] border border-white/5 shadow-xl">
        <h2 className="text-lg font-bold text-gray-200 mb-4">Continue Studying</h2>
        {recentLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentLessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => handleLessonClick(lesson)}
                className="p-4 bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 rounded-xl cursor-pointer transition flex flex-col justify-between h-32"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] bg-white/5 text-gray-400 font-mono px-2 py-0.5 rounded-full">
                      {lesson.category}
                    </span>
                    <span className="text-xs text-gray-500">{lesson.difficulty}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-200 mt-2 line-clamp-1">{lesson.name}</h4>
                </div>
                <div className="text-[10px] text-gray-500 flex justify-between items-center">
                  <span>Last studied: {lesson.progress?.lastStudiedAt ? new Date(lesson.progress.lastStudiedAt).toLocaleDateString() : 'Never'}</span>
                  <span className={`${textAccent} font-bold`}>Resume &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
            <span className="text-3xl">📚</span>
            <p className="text-sm text-gray-400 mt-2 font-medium">No studies recorded yet.</p>
            <p className="text-xs text-gray-500 mt-1">Select a lesson from the sidebar or catalog to begin learning chess theory.</p>
          </div>
        )}
      </div>
    </div>
  );
};
