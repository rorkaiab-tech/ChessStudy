import React, { useEffect, useState } from 'react';
import { db, Lesson, LessonProgress } from '../../database/db';
import { useChessStore, useSettingsStore } from '../../stores/chessStore';
import { ChessBoard } from '../../components/chess/ChessBoard';
import { MoveTreeUI } from '../../components/chess/MoveTreeUI';
import { sound } from '../../services/soundService';
import { Trophy, RotateCw, Lightbulb } from 'lucide-react';

export const ReviewPage: React.FC = () => {
  const { accentColor } = useSettingsStore();
  const practiceState = useChessStore((s) => s.practiceState);
  const practiceFeedback = useChessStore((s) => s.practiceFeedback);
  const interactiveMode = useChessStore((s) => s.interactiveMode);
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);
  const setInteractiveMode = useChessStore((s) => s.setInteractiveMode);
  const initPracticeMode = useChessStore((s) => s.initPracticeMode);

  const [dueLessons, setDueLessons] = useState<(Lesson & { progress?: LessonProgress })[]>([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [correctMoves, setCorrectMoves] = useState(0);

  const loadDueLessons = async () => {
    setLoading(true);
    const progresses = await db.progress.filter((p) => p.dueDate <= Date.now()).toArray();
    const lessons: (Lesson & { progress?: LessonProgress })[] = [];
    for (const p of progresses) {
      const l = await db.lessons.get(p.lessonId);
      if (l) lessons.push({ ...l, progress: p });
    }
    setDueLessons(lessons);
    setActiveReviewIndex(0);
    setLoading(false);
  };

  useEffect(() => {
    loadDueLessons().catch(console.error);
    return () => { setActiveLesson(null); setInteractiveMode('theory'); };
  }, []);

  useEffect(() => {
    if (dueLessons.length > 0 && activeReviewIndex < dueLessons.length) {
      setActiveLesson(dueLessons[activeReviewIndex]);
      setInteractiveMode('practice');
      setMovesPlayed(0); setCorrectMoves(0);
    }
  }, [dueLessons, activeReviewIndex]);

  useEffect(() => {
    if (interactiveMode === 'practice') {
      if (practiceState === 'correct') { setMovesPlayed((m) => m + 1); setCorrectMoves((c) => c + 1); }
      else if (practiceState === 'wrong') { setMovesPlayed((m) => m + 1); }
    }
  }, [practiceState, interactiveMode]);

  const submitReviewRating = async (rating: 'forgotten' | 'hard' | 'good' | 'easy') => {
    sound.playSuccess();
    const lesson = dueLessons[activeReviewIndex];
    if (!lesson || !lesson.id || !lesson.progress) return;

    let interval = lesson.progress.intervalDays || 0;
    let repetitions = lesson.progress.repetitions || 0;
    let easeFactor = lesson.progress.easeFactor || 2.5;

    if (rating === 'forgotten') { interval = 1; repetitions = 0; easeFactor = Math.max(1.3, easeFactor - 0.2); }
    else if (rating === 'hard') { repetitions = 0; interval = 1; easeFactor = Math.max(1.3, easeFactor - 0.15); }
    else if (rating === 'good') {
      repetitions += 1;
      if (repetitions === 1) interval = 1; else if (repetitions === 2) interval = 3;
      else interval = Math.round(interval * easeFactor);
    } else if (rating === 'easy') {
      repetitions += 1;
      if (repetitions === 1) interval = 3; else if (repetitions === 2) interval = 7;
      else interval = Math.round(interval * easeFactor * 1.5);
      easeFactor += 0.15;
    }

    const cappedInterval = Math.min(30, interval);
    const nextDueDate = Date.now() + cappedInterval * 24 * 60 * 60 * 1000;
    let masteryState: 'learning' | 'reviewing' | 'mastered' = 'learning';
    if (cappedInterval >= 14) masteryState = 'mastered'; else if (cappedInterval >= 7) masteryState = 'reviewing';

    await db.progress.put({
      lessonId: lesson.id, lastStudiedAt: Date.now(), intervalDays: cappedInterval,
      easeFactor, repetitions, dueDate: nextDueDate, masteryState,
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const existingHistory = await db.history.where('date').equals(todayStr).first();
    if (existingHistory) {
      await db.history.update(existingHistory.id!, {
        movesPlayed: existingHistory.movesPlayed + movesPlayed,
        correctMoves: existingHistory.correctMoves + correctMoves,
      });
    } else {
      await db.history.add({ date: todayStr, movesPlayed: Math.max(1, movesPlayed), correctMoves });
    }

    if (activeReviewIndex + 1 >= dueLessons.length) loadDueLessons();
    else setActiveReviewIndex((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-l-accent-blue/20 border-t-l-accent-blue animate-spin" />
      </div>
    );
  }

  if (dueLessons.length === 0 || activeReviewIndex >= dueLessons.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto py-20 animate-slide-up">
        <Trophy size={48} className="text-l-accent-orange mb-4" />
        <h1 className="text-2xl font-semibold text-white">Review Complete!</h1>
        <p className="text-sm text-l-text-muted mt-2 leading-relaxed">All scheduled reviews for today are done.</p>
        <button onClick={() => loadDueLessons()}
          className="mt-6 px-5 py-2.5 text-xs font-medium text-white bg-l-accent-blue rounded-md cursor-pointer transition-all">
          Check Again
        </button>
      </div>
    );
  }

  const activeLesson = dueLessons[activeReviewIndex];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-stretch animate-slide-up">
      <div className="lg:col-span-7 flex flex-col items-center justify-center">
        <div className="w-full flex justify-between items-center mb-3">
          <span className="text-xs font-semibold text-l-text-dim uppercase tracking-wider">
            Review {activeReviewIndex + 1} of {dueLessons.length}
          </span>
          <span className="text-[10px] font-medium text-l-accent-blue">Due Today</span>
        </div>
        <ChessBoard />
      </div>

      <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
        <div className="space-y-5 flex-1 flex flex-col">
          <div className="p-4 bg-l-bg-light border border-white/[0.06] rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] bg-white/[0.05] text-l-text-dim font-medium px-2 py-0.5 rounded">{activeLesson.category}</span>
              <span className="text-[10px] text-l-text-dim">{activeLesson.difficulty}</span>
            </div>
            <h2 className="text-lg font-semibold text-white">{activeLesson.name}</h2>
            <p className="text-xs text-l-text-dim leading-relaxed">{activeLesson.description}</p>
          </div>

          <MoveTreeUI />

          <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg flex-1 flex flex-col justify-center">
            <h4 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider mb-2">Instructions</h4>
            <p className="text-sm text-l-text leading-relaxed">{practiceFeedback}</p>
          </div>
        </div>

        {practiceState === 'complete' ? (
          <div className="p-5 bg-l-bg-light border border-green-500/20 rounded-lg space-y-3 animate-fade-in">
            <div className="text-center">
              <h3 className="text-sm font-semibold text-l-accent-green">Solved!</h3>
              <p className="text-xs text-l-text-dim mt-1">Rate this review:</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => submitReviewRating('forgotten')}
                className="py-2.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-md text-xs font-medium text-red-400 transition-colors cursor-pointer">Forgotten (1d)</button>
              <button onClick={() => submitReviewRating('hard')}
                className="py-2.5 bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/20 rounded-md text-xs font-medium text-orange-400 transition-colors cursor-pointer">Hard (1d)</button>
              <button onClick={() => submitReviewRating('good')}
                className="py-2.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-md text-xs font-medium text-blue-400 transition-colors cursor-pointer">Good</button>
              <button onClick={() => submitReviewRating('easy')}
                className="py-2.5 bg-green-500/10 hover:bg-green-500/15 border border-green-500/20 rounded-md text-xs font-medium text-green-400 transition-colors cursor-pointer">Easy</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { sound.playHover(); initPracticeMode(); }}
              className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-xs font-medium text-l-text transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5">
              <RotateCw size={14} />Restart
            </button>
            <button onClick={() => {
              sound.playSuccess();
              const expected = useChessStore.getState().practiceExpectedNodes[0];
              if (expected) useChessStore.setState({ practiceFeedback: `Hint: Move from ${expected.from}!` });
            }} className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-xs font-medium text-l-text transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5">
              <Lightbulb size={14} />Hint
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
