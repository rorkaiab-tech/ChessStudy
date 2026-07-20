import React, { useEffect, useState } from 'react';
import { db, Lesson, LessonProgress } from '../../database/db';
import { useChessStore } from '../../stores/chessStore';
import { useNavigate } from 'react-router-dom';
import { sound } from '../../services/soundService';
import { Plus, Star, BookOpen } from 'lucide-react';

interface CategoryPageProps {
  category: 'Openings' | 'Traps' | 'Middlegame' | 'Endgames' | 'Favorites';
}

export const CategoryPage: React.FC<CategoryPageProps> = ({ category }) => {
  const navigate = useNavigate();
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);

  const [lessons, setLessons] = useState<(Lesson & { progress?: LessonProgress })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLessons = async () => {
    setLoading(true);
    let list: Lesson[] = category === 'Favorites'
      ? await db.lessons.where('isFavorite').equals(1).toArray()
      : await db.lessons.where('category').equals(category).toArray();

    const fullList: (Lesson & { progress?: LessonProgress })[] = [];
    for (const l of list) {
      if (l.id) fullList.push({ ...l, progress: await db.progress.get(l.id) });
    }
    setLessons(fullList);
    setLoading(false);
  };

  useEffect(() => { loadLessons().catch(console.error); }, [category]);

  const handleToggleFavorite = async (e: React.MouseEvent, lesson: Lesson) => {
    e.stopPropagation();
    sound.playSuccess();
    await db.lessons.update(lesson.id!, { isFavorite: lesson.isFavorite === 1 ? 0 : 1 });
    loadLessons();
  };

  const handleStartStudy = (lesson: Lesson) => {
    sound.playSuccess();
    setActiveLesson(lesson);
    navigate(`/lessons/${lesson.id}`);
  };

  const totalCount = lessons.length;
  const masteredCount = lessons.filter((l) => l.progress?.masteryState === 'mastered').length;
  const dueCount = lessons.filter((l) => l.progress && l.progress.dueDate <= Date.now() && l.progress.intervalDays > 0).length;

  return (
    <div className="space-y-6 animate-slide-up flex-1 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">{category}</h1>
          <p className="text-sm text-l-text-muted mt-1.5">
            {category === 'Favorites'
              ? 'Your starred lessons.'
              : `Browse ${category.toLowerCase()} modules.`}
          </p>
        </div>
        {category !== 'Favorites' && (
          <button
            onClick={() => { sound.playSuccess(); navigate('/lessons'); }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-l-accent-blue rounded-md hover:brightness-110 cursor-pointer transition-all"
          >
            <Plus size={14} />New Lesson
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-l-bg-light border border-white/[0.06]">
        <div className="text-center py-1.5 border-r border-white/[0.06]">
          <div className="text-[10px] text-l-text-dim font-semibold uppercase tracking-wider">Total</div>
          <div className="text-lg font-semibold text-white mt-0.5">{totalCount}</div>
        </div>
        <div className="text-center py-1.5 border-r border-white/[0.06]">
          <div className="text-[10px] text-l-text-dim font-semibold uppercase tracking-wider">Mastered</div>
          <div className="text-lg font-semibold text-l-accent-green mt-0.5">{masteredCount}</div>
        </div>
        <div className="text-center py-1.5">
          <div className="text-[10px] text-l-text-dim font-semibold uppercase tracking-wider">Due</div>
          <div className="text-lg font-semibold text-l-accent-orange mt-0.5">{dueCount}</div>
        </div>
      </div>

      {/* Catalog */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-l-accent-blue/20 border-t-l-accent-blue animate-spin" />
        </div>
      ) : lessons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {lessons.map((lesson) => {
            const mastery = lesson.progress?.masteryState || 'new';
            const isDue = lesson.progress && lesson.progress.dueDate <= Date.now() && lesson.progress.intervalDays > 0;

            return (
              <div
                key={lesson.id}
                onClick={() => handleStartStudy(lesson)}
                className="p-5 rounded-lg bg-l-bg-light border border-white/[0.06] hover:border-white/10 transition-colors flex flex-col justify-between h-[180px] cursor-pointer group"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-1.5">
                      <span className="text-[10px] bg-white/[0.05] text-l-text-dim font-medium px-2 py-0.5 rounded">
                        {lesson.difficulty}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                        mastery === 'mastered' ? 'bg-green-500/10 text-green-400'
                          : mastery === 'reviewing' ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-white/[0.05] text-l-text-dim'
                      }`}>
                        {mastery}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleToggleFavorite(e, lesson)}
                      className="text-l-text-dim hover:text-yellow-400 transition-colors p-1 rounded cursor-pointer"
                    >
                      <Star size={14} fill={lesson.isFavorite === 1 ? 'currentColor' : 'none'} className={lesson.isFavorite === 1 ? 'text-yellow-400' : ''} />
                    </button>
                  </div>
                  <h3 className="text-sm font-semibold text-white mt-3 line-clamp-1 group-hover:text-l-accent-blue transition-colors">
                    {lesson.name}
                  </h3>
                  <p className="text-xs text-l-text-dim mt-1 line-clamp-2 leading-relaxed">
                    {lesson.description || 'No description.'}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    {isDue && <span className="w-2 h-2 rounded-full bg-l-accent-orange animate-pulse" />}
                    <span className="text-l-text-dim font-medium">
                      {isDue ? 'Due for review' : lesson.progress?.lastStudiedAt ? 'Studied' : 'New'}
                    </span>
                  </div>
                  <span className="text-l-accent-blue font-medium">Study &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-16 border border-dashed border-white/[0.08] rounded-lg">
          <BookOpen size={32} className="text-l-text-dim mb-3" />
          <h3 className="text-sm font-semibold text-l-text-muted">No lessons found</h3>
          <p className="text-xs text-l-text-dim mt-1">
            {category === 'Favorites' ? 'Star lessons to see them here.' : `Create a ${category.toLowerCase()} lesson to get started.`}
          </p>
        </div>
      )}
    </div>
  );
};
