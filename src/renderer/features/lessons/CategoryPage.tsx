import React, { useEffect, useState } from 'react';
import { db, Lesson, LessonProgress } from '../../database/db';
import { useChessStore, useSettingsStore } from '../../stores/chessStore';
import { useNavigate } from 'react-router-dom';
import { sound } from '../../services/soundService';

interface CategoryPageProps {
  category: 'Openings' | 'Traps' | 'Middlegame' | 'Endgames' | 'Favorites';
}

export const CategoryPage: React.FC<CategoryPageProps> = ({ category }) => {
  const navigate = useNavigate();
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);
  const { accentColor } = useSettingsStore();

  const [lessons, setLessons] = useState<(Lesson & { progress?: LessonProgress })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLessons = async () => {
    setLoading(true);
    let list: Lesson[] = [];

    if (category === 'Favorites') {
      list = await db.lessons.where('isFavorite').equals(1).toArray();
    } else {
      list = await db.lessons.where('category').equals(category).toArray();
    }

    const fullList: (Lesson & { progress?: LessonProgress })[] = [];
    for (const l of list) {
      if (l.id) {
        const prog = await db.progress.get(l.id);
        fullList.push({ ...l, progress: prog });
      }
    }

    setLessons(fullList);
    setLoading(false);
  };

  useEffect(() => {
    loadLessons().catch((err) => console.error('Category load failed:', err));
  }, [category]);

  const handleToggleFavorite = async (e: React.MouseEvent, lesson: Lesson) => {
    e.stopPropagation();
    sound.playSuccess();
    const updatedVal = lesson.isFavorite === 1 ? 0 : 1;
    await db.lessons.update(lesson.id!, { isFavorite: updatedVal });
    loadLessons();
  };

  const handleStartStudy = (lesson: Lesson) => {
    sound.playSuccess();
    setActiveLesson(lesson);
    navigate(`/lessons/${lesson.id}`);
  };

  // Color helper functions
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
    emerald: 'bg-emerald-500 hover:bg-emerald-600',
    blue: 'bg-blue-500 hover:bg-blue-600',
    amber: 'bg-amber-500 hover:bg-amber-600',
    rose: 'bg-rose-500 hover:bg-rose-600',
    indigo: 'bg-indigo-500 hover:bg-indigo-600',
  }[accentColor];

  // Category stats calculation
  const totalCount = lessons.length;
  const masteredCount = lessons.filter((l) => l.progress?.masteryState === 'mastered').length;
  const dueCount = lessons.filter((l) => l.progress && l.progress.dueDate <= Date.now() && l.progress.intervalDays > 0).length;

  return (
    <div className="space-y-8 animate-fade-in flex-1 flex flex-col">
      {/* Category Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">{category}</h1>
          <p className="text-sm text-gray-400 mt-2">
            {category === 'Favorites'
              ? 'Your starred lessons compiled in a single study board.'
              : `Browse and practice local modules tagged in the ${category} category.`}
          </p>
        </div>

        {/* Create Lesson quick jump */}
        {category !== 'Favorites' && (
          <button
            onClick={() => {
              sound.playSuccess();
              navigate('/lessons');
            }}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl cursor-pointer shadow-lg transition duration-200 ${bgAccent}`}
          >
            + Create New Lesson
          </button>
        )}
      </div>

      {/* Category Stats Bar */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-[#0f1216] border border-white/5 rounded-2xl">
        <div className="text-center py-2 border-r border-white/5">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Modules</div>
          <div className="text-xl font-bold text-gray-200 mt-1">{totalCount}</div>
        </div>
        <div className="text-center py-2 border-r border-white/5">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Mastered</div>
          <div className="text-xl font-bold text-green-400 mt-1">{masteredCount}</div>
        </div>
        <div className="text-center py-2">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Due for Review</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{dueCount}</div>
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        </div>
      ) : lessons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          {lessons.map((lesson) => {
            const mastery = lesson.progress?.masteryState || 'new';
            const isDue = lesson.progress && lesson.progress.dueDate <= Date.now() && lesson.progress.intervalDays > 0;

            return (
              <div
                key={lesson.id}
                onClick={() => handleStartStudy(lesson)}
                className={`p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.01] border ${borderHighlight} shadow-xl hover:shadow-2xl transition duration-200 flex flex-col justify-between h-[200px] cursor-pointer group`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    {/* Tags / Difficulty */}
                    <div className="flex gap-2">
                      <span className="text-[10px] bg-white/5 border border-white/5 text-gray-400 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {lesson.difficulty}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        mastery === 'mastered'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/10'
                          : mastery === 'reviewing'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                            : 'bg-white/5 text-gray-400'
                      }`}>
                        {mastery}
                      </span>
                    </div>

                    {/* Favorite Star Button */}
                    <button
                      onClick={(e) => handleToggleFavorite(e, lesson)}
                      className="text-gray-500 hover:text-amber-400 transition scale-110 p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      {lesson.isFavorite === 1 ? '★' : '☆'}
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-gray-200 mt-4 line-clamp-1 group-hover:text-white transition">
                    {lesson.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                    {lesson.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    {isDue && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" title="Due for Spaced Repetition" />
                    )}
                    <span className="text-gray-500 font-semibold">
                      {isDue ? 'Due for review' : lesson.progress?.lastStudiedAt ? 'Completed study' : 'Never studied'}
                    </span>
                  </div>
                  <span className={`${textAccent} font-extrabold hover:underline flex items-center gap-1`}>
                    Study &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-[#0f1216]/40 border border-dashed border-white/5 rounded-2xl">
          <span className="text-5xl mb-4">📖</span>
          <h3 className="text-lg font-bold text-gray-300">Catalog is Empty</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-[300px] text-center">
            {category === 'Favorites'
              ? 'You have not favorited any lessons yet. Star lessons in other catalogs.'
              : `Create your first chess study module to organize your ${category} knowledge.`}
          </p>
        </div>
      )}
    </div>
  );
};
