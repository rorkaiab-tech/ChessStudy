import React, { useEffect, useState } from 'react';
import { db, Lesson, LessonProgress, StudyHistory } from '../../database/db';
import { useChessStore } from '../../stores/chessStore';
import { Link, useNavigate } from 'react-router-dom';
import { sound } from '../../services/soundService';
import { Flame, Target, Zap, ChevronRight, BookOpen, Settings, GraduationCap } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);

  const [streak, setStreak] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [recentLessons, setRecentLessons] = useState<(Lesson & { progress?: LessonProgress })[]>([]);
  const [weeklyHistory, setWeeklyHistory] = useState<{ day: string; count: number }[]>([]);
  const [favOpening, setFavOpening] = useState<Lesson | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      const history = await db.history.toArray();
      setStreak(calculateStreak(history));

      let totalMoves = 0, totalCorrect = 0;
      history.forEach((h) => { totalMoves += h.movesPlayed; totalCorrect += h.correctMoves; });
      setAccuracy(totalMoves > 0 ? Math.round((totalCorrect / totalMoves) * 100) : 0);

      const now = Date.now();
      setReviewCount(await db.progress.filter((p) => p.dueDate <= now && p.intervalDays > 0).count());

      const progressList = await db.progress.filter((p) => p.lastStudiedAt > 0).sortBy('lastStudiedAt');
      const recents: (Lesson & { progress?: LessonProgress })[] = [];
      for (const p of progressList.reverse().slice(0, 3)) {
        const l = await db.lessons.get(p.lessonId);
        if (l) recents.push({ ...l, progress: p });
      }
      setRecentLessons(recents);

      setFavOpening((await db.lessons.where('category').equals('Openings').and((l) => l.isFavorite === 1).first()) || null);
      setWeeklyHistory(getLast7DaysProgress(history));
    };
    loadDashboardData().catch(console.error);
  }, []);

  const calculateStreak = (history: StudyHistory[]): number => {
    if (history.length === 0) return 0;
    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastDate = sorted[0].date;
    if (lastDate !== todayStr && lastDate !== yesterdayStr) return 0;
    let currentStreak = 0;
    let checkDate = new Date(lastDate === todayStr ? todayStr : yesterdayStr);
    for (let i = 0; i < 30; i++) {
      const checkStr = checkDate.toISOString().split('T')[0];
      if (sorted.some((h) => h.date === checkStr && h.movesPlayed > 0)) {
        currentStreak++; checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }
    return currentStreak;
  };

  const getLast7DaysProgress = (history: StudyHistory[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result: { day: string; count: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hEntry = history.find((h) => h.date === dateStr);
      result.push({ day: days[d.getDay()], count: hEntry ? hEntry.movesPlayed : 0 });
    }
    return result;
  };

  const handleLessonClick = (lesson: Lesson) => {
    sound.playSuccess();
    setActiveLesson(lesson);
    navigate(`/lessons/${lesson.id}`);
  };

  const maxWeeklyCount = Math.max(...weeklyHistory.map((w) => w.count), 1);

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome back</h1>
        <p className="text-sm text-l-text-muted mt-1.5">
          Review scheduled cards or study new theory.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-lg bg-l-bg-light border border-white/[0.06] transition-colors hover:border-white/10">
          <div className="flex justify-between items-start">
            <h3 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Study Streak</h3>
            <Flame size={18} className="text-orange-400" />
          </div>
          <p className="text-3xl font-semibold mt-3 text-white">
            {streak} <span className="text-xs font-medium text-l-text-dim">days</span>
          </p>
          <p className="text-xs text-l-text-dim mt-1.5">
            {streak > 0 ? 'Keep it going!' : 'Study today to start.'}
          </p>
        </div>

        <div className="p-5 rounded-lg bg-l-bg-light border border-white/[0.06] transition-colors hover:border-white/10">
          <div className="flex justify-between items-start">
            <h3 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Accuracy</h3>
            <Target size={18} className="text-l-accent-blue" />
          </div>
          <p className="text-3xl font-semibold mt-3 text-white">{accuracy}%</p>
          <p className="text-xs text-l-text-dim mt-1.5">Across all quizzes.</p>
        </div>

        <div className="p-5 rounded-lg bg-l-bg-light border border-white/[0.06] transition-colors hover:border-white/10">
          <div className="flex justify-between items-start">
            <h3 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Due for Review</h3>
            <Zap size={18} className="text-l-accent-orange" />
          </div>
          <p className="text-3xl font-semibold mt-3 text-white">
            {reviewCount} <span className="text-xs font-medium text-l-text-dim">cards</span>
          </p>
          <p className="text-xs text-l-text-dim mt-1.5">
            {reviewCount > 0 ? (
              <Link to="/review" onClick={() => sound.playHover()} className="text-l-accent-blue font-medium hover:underline">
                Start Review <ChevronRight size={12} className="inline" />
              </Link>
            ) : 'All caught up!'}
          </p>
        </div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Activity */}
        <div className="lg:col-span-2 p-5 rounded-lg bg-l-bg-light border border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Weekly Progress</h2>
          <p className="text-xs text-l-text-dim mt-0.5">Moves studied per day.</p>

          <div className="h-36 flex items-end justify-between gap-3 mt-5 px-1">
            {weeklyHistory.map((item, idx) => {
              const pct = (item.count / maxWeeklyCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group cursor-help">
                  <div className="relative w-full flex justify-center">
                    <span className="absolute -top-7 bg-l-bg text-white text-[10px] font-medium px-2 py-0.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                      {item.count} moves
                    </span>
                    <div
                      style={{ height: `${Math.max(pct, 4)}%` }}
                      className={`w-7 rounded-t transition-all duration-500 bg-l-accent-blue ${
                        item.count > 0 ? 'opacity-70 group-hover:opacity-100' : 'opacity-15'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-l-text-dim">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="p-5 rounded-lg bg-l-bg-light border border-white/[0.06] flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Highlights</h2>
            <p className="text-xs text-l-text-dim mt-0.5">Quick-start topics.</p>
          </div>
          <div className="my-5 space-y-3 flex-1 flex flex-col justify-center">
            {favOpening ? (
              <div
                onClick={() => handleLessonClick(favOpening)}
                className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-lg hover:bg-white/[0.06] cursor-pointer transition-colors"
              >
                <div className="text-[10px] uppercase font-semibold text-l-accent-blue tracking-wider">Favorite Opening</div>
                <div className="text-sm font-medium text-white mt-1 truncate">{favOpening.name}</div>
                <div className="text-xs text-l-text-dim mt-0.5">{favOpening.difficulty} &bull; {favOpening.tags[0]}</div>
              </div>
            ) : (
              <div className="text-xs text-l-text-dim italic p-4 border border-dashed border-white/10 rounded-lg text-center">
                Star an opening to show here.
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { sound.playSuccess(); navigate('/search'); }}
                className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-xs font-medium text-l-text transition-colors cursor-pointer text-center"
              >
                <BookOpen size={14} className="inline mr-1.5 -mt-0.5" />Browse
              </button>
              <button
                onClick={() => { sound.playSuccess(); navigate('/settings'); }}
                className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-xs font-medium text-l-text transition-colors cursor-pointer text-center"
              >
                <Settings size={14} className="inline mr-1.5 -mt-0.5" />Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent lessons */}
      <div className="p-5 rounded-lg bg-l-bg-light border border-white/[0.06]">
        <h2 className="text-sm font-semibold text-white mb-4">Continue Studying</h2>
        {recentLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentLessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => handleLessonClick(lesson)}
                className="p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] rounded-lg cursor-pointer transition-colors flex flex-col justify-between h-28"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] bg-white/[0.05] text-l-text-dim font-medium px-2 py-0.5 rounded">
                      {lesson.category}
                    </span>
                    <span className="text-[10px] text-l-text-dim">{lesson.difficulty}</span>
                  </div>
                  <h4 className="text-sm font-medium text-white mt-2 line-clamp-1">{lesson.name}</h4>
                </div>
                <div className="text-[10px] text-l-text-dim flex justify-between items-center">
                  <span>Last: {lesson.progress?.lastStudiedAt ? new Date(lesson.progress.lastStudiedAt).toLocaleDateString() : 'Never'}</span>
                  <span className="text-l-accent-blue font-medium">Resume <ChevronRight size={10} className="inline" /></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white/[0.01] rounded-lg border border-dashed border-white/[0.06]">
            <GraduationCap size={32} className="mx-auto text-l-text-dim mb-2" />
            <p className="text-sm text-l-text-muted font-medium">No studies recorded yet.</p>
            <p className="text-xs text-l-text-dim mt-1">Select a lesson to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
};


