import React, { useEffect, useState } from 'react';
import { db, Lesson, LessonProgress } from '../../database/db';
import { useChessStore, useSettingsStore } from '../../stores/chessStore';
import { ChessBoard } from '../../components/chess/ChessBoard';
import { MoveTreeUI } from '../../components/chess/MoveTreeUI';
import { sound } from '../../services/soundService';

export const ReviewPage: React.FC = () => {
  const { accentColor } = useSettingsStore();
  const currentFen = useChessStore((s) => s.currentFen);
  const practiceState = useChessStore((s) => s.practiceState);
  const practiceFeedback = useChessStore((s) => s.practiceFeedback);
  const interactiveMode = useChessStore((s) => s.interactiveMode);
  
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);
  const setInteractiveMode = useChessStore((s) => s.setInteractiveMode);
  const initPracticeMode = useChessStore((s) => s.initPracticeMode);

  const [dueLessons, setDueLessons] = useState<(Lesson & { progress?: LessonProgress })[]>([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Moves tracking for today's history statistics
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [correctMoves, setCorrectMoves] = useState(0);

  const loadDueLessons = async () => {
    setLoading(true);
    const now = Date.now();
    // Get all progresses where dueDate <= now
    const progresses = await db.progress
      .filter((p) => p.dueDate <= now)
      .toArray();

    const lessons: (Lesson & { progress?: LessonProgress })[] = [];
    for (const p of progresses) {
      const l = await db.lessons.get(p.lessonId);
      if (l) {
        lessons.push({ ...l, progress: p });
      }
    }

    setDueLessons(lessons);
    setActiveReviewIndex(0);
    setLoading(false);
  };

  useEffect(() => {
    loadDueLessons().catch(err => console.error('Failed to load review items:', err));

    // Cleanup on page switch
    return () => {
      setActiveLesson(null);
      setInteractiveMode('theory');
    };
  }, []);

  // When active review index changes, set the active lesson in store
  useEffect(() => {
    if (dueLessons.length > 0 && activeReviewIndex < dueLessons.length) {
      const lesson = dueLessons[activeReviewIndex];
      setActiveLesson(lesson);
      setInteractiveMode('practice');
      setMovesPlayed(0);
      setCorrectMoves(0);
    }
  }, [dueLessons, activeReviewIndex]);

  // Track moves played locally to add to statistics
  useEffect(() => {
    if (interactiveMode === 'practice') {
      if (practiceState === 'correct') {
        setMovesPlayed((m) => m + 1);
        setCorrectMoves((c) => c + 1);
      } else if (practiceState === 'wrong') {
        setMovesPlayed((m) => m + 1);
      }
    }
  }, [practiceState, interactiveMode]);

  // SM-2 Spaced Repetition rating submitter
  const submitReviewRating = async (rating: 'forgotten' | 'hard' | 'good' | 'easy') => {
    sound.playSuccess();
    const lesson = dueLessons[activeReviewIndex];
    if (!lesson || !lesson.id || !lesson.progress) return;

    let interval = lesson.progress.intervalDays || 0;
    let repetitions = lesson.progress.repetitions || 0;
    let easeFactor = lesson.progress.easeFactor || 2.5;

    if (rating === 'forgotten') {
      interval = 1;
      repetitions = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else if (rating === 'hard') {
      repetitions = 0;
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.15);
    } else if (rating === 'good') {
      repetitions += 1;
      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 3;
      } else {
        interval = Math.round(interval * easeFactor);
      }
    } else if (rating === 'easy') {
      repetitions += 1;
      if (repetitions === 1) {
        interval = 3;
      } else if (repetitions === 2) {
        interval = 7;
      } else {
        interval = Math.round(interval * easeFactor * 1.5);
      }
      easeFactor = easeFactor + 0.15;
    }

    // Cap interval at maximum 30 days as requested by user ("Intervals: 1 day, 3 days, 7 days, 14 days, 30 days")
    const cappedInterval = Math.min(30, interval);
    const nextDueDate = Date.now() + cappedInterval * 24 * 60 * 60 * 1000;

    let masteryState: 'learning' | 'reviewing' | 'mastered' = 'learning';
    if (cappedInterval >= 14) masteryState = 'mastered';
    else if (cappedInterval >= 7) masteryState = 'reviewing';

    // 1. Update Spaced Repetition Progress
    await db.progress.put({
      lessonId: lesson.id,
      lastStudiedAt: Date.now(),
      intervalDays: cappedInterval,
      easeFactor,
      repetitions,
      dueDate: nextDueDate,
      masteryState,
    });

    // 2. Add Stats to History database
    const todayStr = new Date().toISOString().split('T')[0];
    const existingHistory = await db.history.where('date').equals(todayStr).first();
    if (existingHistory) {
      await db.history.update(existingHistory.id!, {
        movesPlayed: existingHistory.movesPlayed + movesPlayed,
        correctMoves: existingHistory.correctMoves + correctMoves,
      });
    } else {
      await db.history.add({
        date: todayStr,
        movesPlayed: Math.max(1, movesPlayed),
        correctMoves: correctMoves,
      });
    }

    // 3. Move to next due card
    if (activeReviewIndex + 1 >= dueLessons.length) {
      // Reload if completed all
      loadDueLessons();
    } else {
      setActiveReviewIndex((prev) => prev + 1);
    }
  };

  const bgAccent = {
    emerald: 'bg-emerald-500 hover:bg-emerald-600',
    blue: 'bg-blue-500 hover:bg-blue-600',
    amber: 'bg-amber-500 hover:bg-amber-600',
    rose: 'bg-rose-500 hover:bg-rose-600',
    indigo: 'bg-indigo-500 hover:bg-indigo-600',
  }[accentColor];

  const textAccent = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    indigo: 'text-indigo-400',
  }[accentColor];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  // Finished State
  if (dueLessons.length === 0 || activeReviewIndex >= dueLessons.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto py-20 animate-fade-in">
        <span className="text-6xl mb-6">🏆</span>
        <h1 className="text-3xl font-extrabold text-gray-100">Review Complete!</h1>
        <p className="text-sm text-gray-400 mt-3 leading-relaxed">
          Amazing study! You have reviewed all scheduled chess lessons due for today. Keep practicing to build your chess memory.
        </p>
        <button
          onClick={() => loadDueLessons()}
          className={`mt-8 px-6 py-3 text-xs font-bold text-white rounded-xl cursor-pointer shadow-lg transition duration-150 ${bgAccent}`}
        >
          Check Again
        </button>
      </div>
    );
  }

  const activeLesson = dueLessons[activeReviewIndex];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-stretch animate-fade-in">
      {/* Left Column: Interactive board (7 cols) */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center">
        <div className="w-full flex justify-between items-center mb-4">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Review {activeReviewIndex + 1} of {dueLessons.length}
          </span>
          <span className="text-xs font-bold text-indigo-400">
            Due Today
          </span>
        </div>
        <ChessBoard />
      </div>

      {/* Right Column: Spaced rep review controls (5 cols) */}
      <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
        <div className="space-y-6 flex-1 flex flex-col">
          {/* Card Description */}
          <div className="p-6 bg-[#0f1216] border border-white/5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] bg-white/5 text-gray-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {activeLesson.category}
              </span>
              <span className="text-xs text-gray-500 font-semibold">{activeLesson.difficulty}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-100">{activeLesson.name}</h2>
            <p className="text-xs text-gray-400 leading-relaxed">{activeLesson.description}</p>
          </div>

          {/* Move tree visualization */}
          <MoveTreeUI />

          {/* Live Instruction Feedback Panel */}
          <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex-1 flex flex-col justify-center">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Practice Instructions</h4>
            <p className="text-sm font-semibold text-gray-200 leading-relaxed">
              {practiceFeedback}
            </p>
          </div>
        </div>

        {/* Spaced Repetition Scoring Overlays */}
        {practiceState === 'complete' ? (
          <div className="p-6 bg-[#12151b] border border-green-500/20 rounded-2xl space-y-4 animate-fade-in shadow-2xl">
            <div className="text-center">
              <h3 className="text-sm font-bold text-green-400">Lesson Solved!</h3>
              <p className="text-xs text-gray-400 mt-1">Rate this memory review to schedule the next repetition:</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => submitReviewRating('forgotten')}
                className="py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold text-red-400 transition cursor-pointer"
              >
                Forgotten (1d)
              </button>
              <button
                onClick={() => submitReviewRating('hard')}
                className="py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-400 transition cursor-pointer"
              >
                Hard (1d)
              </button>
              <button
                onClick={() => submitReviewRating('good')}
                className="py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-300 transition cursor-pointer"
              >
                Good ({activeLesson.progress?.intervalDays ? Math.max(3, Math.round(activeLesson.progress.intervalDays * 2.4)) : 7}d)
              </button>
              <button
                onClick={() => submitReviewRating('easy')}
                className="py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl text-xs font-bold text-green-400 transition cursor-pointer"
              >
                Easy ({activeLesson.progress?.intervalDays ? Math.max(7, Math.round(activeLesson.progress.intervalDays * 3.6)) : 14}d)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                sound.playHover();
                initPracticeMode();
              }}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-gray-400 transition cursor-pointer text-center"
            >
              Restart Practice
            </button>
            <button
              onClick={() => {
                sound.playSuccess();
                // Set practice feedback to first expected move hint
                const expected = useChessStore.getState().practiceExpectedNodes[0];
                if (expected) {
                  useChessStore.setState({
                    practiceFeedback: `Hint: Focus on moving a piece from ${expected.from}!`,
                  });
                }
              }}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-gray-400 transition cursor-pointer text-center"
            >
              Request Hint
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
