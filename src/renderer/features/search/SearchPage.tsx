import React, { useEffect, useState } from 'react';
import { db, Lesson } from '../../database/db';
import { useChessStore } from '../../stores/chessStore';
import { useNavigate } from 'react-router-dom';
import { sound } from '../../services/soundService';
import { Search, X, BookOpen } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [query, setQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const popularTags = [
    'Opening', 'Najdorf', 'Ruy Lopez', 'Tactics', 'Trap', 'Fork', 'Pin',
    'Skewer', 'Discovered Attack', 'Sacrifice', 'Mate', 'Defense',
    'Counterattack', 'Initiative', 'Passed Pawn', 'Rook Endgame', 'Lucena'
  ];

  useEffect(() => { db.lessons.toArray().then(setLessons); }, []);

  const handleTagToggle = (tag: string) => {
    sound.playHover();
    setActiveTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleStartStudy = (lesson: Lesson) => {
    sound.playSuccess();
    setActiveLesson(lesson);
    navigate(`/lessons/${lesson.id}`);
  };

  const filtered = lessons.filter((lesson) => {
    const textMatch = lesson.name.toLowerCase().includes(query.toLowerCase()) ||
      lesson.description.toLowerCase().includes(query.toLowerCase()) ||
      lesson.category.toLowerCase().includes(query.toLowerCase());
    const diffMatch = selectedDifficulty === 'All' || lesson.difficulty === selectedDifficulty;
    const catMatch = selectedCategory === 'All' || lesson.category === selectedCategory;
    const tagsMatch = activeTags.length === 0 || activeTags.every((t) => lesson.tags.includes(t));
    return textMatch && diffMatch && catMatch && tagsMatch;
  });

  const filterBtnActive = "bg-l-accent-blue text-white border-transparent";
  const filterBtnInactive = "bg-white/[0.04] border-white/[0.06] text-l-text-dim hover:text-l-text";

  return (
    <div className="space-y-6 animate-slide-up flex-1 flex flex-col">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Search</h1>
        <p className="text-sm text-l-text-muted mt-1.5">Find lessons by name, category, difficulty, or motif.</p>
      </div>

      <div className="relative w-full">
        <input type="text" placeholder="Filter lessons..." value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-l-bg-light border border-white/[0.06] rounded-md px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors text-l-text" />
        <Search size={16} className="absolute left-3.5 top-3 text-l-text-dim" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-l-text-dim uppercase tracking-wider">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {['All', 'Openings', 'Traps', 'Middlegame', 'Endgames', 'Lessons'].map((cat) => (
              <button key={cat} onClick={() => { sound.playHover(); setSelectedCategory(cat); }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${selectedCategory === cat ? filterBtnActive : filterBtnInactive}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-l-text-dim uppercase tracking-wider">Difficulty</label>
          <div className="flex flex-wrap gap-1.5">
            {['All', 'Beginner', 'Intermediate', 'Advanced'].map((diff) => (
              <button key={diff} onClick={() => { sound.playHover(); setSelectedDifficulty(diff); }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${selectedDifficulty === diff ? filterBtnActive : filterBtnInactive}`}>
                {diff}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold text-l-text-dim uppercase tracking-wider">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {popularTags.map((tag) => {
            const isActive = activeTags.includes(tag);
            return (
              <button key={tag} onClick={() => handleTagToggle(tag)}
                className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  isActive ? 'bg-l-accent-blue text-white font-medium' : 'bg-white/[0.03] hover:bg-white/[0.06] text-l-text-dim border border-white/[0.06]'
                }`}>
                {tag} {isActive && <X size={10} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
        <span className="text-[10px] font-semibold text-l-text-dim uppercase tracking-wider">Results ({filtered.length})</span>
        {activeTags.length > 0 && (
          <button onClick={() => { sound.playError(); setActiveTags([]); }}
            className="text-[10px] font-medium text-red-400 hover:underline cursor-pointer">Clear Tags</button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
          {filtered.map((lesson) => (
            <div key={lesson.id} onClick={() => handleStartStudy(lesson)}
              className="p-5 rounded-lg bg-l-bg-light border border-white/[0.06] hover:border-white/10 transition-colors flex flex-col justify-between h-[180px] cursor-pointer group">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] bg-white/[0.05] text-l-text-dim font-medium px-2 py-0.5 rounded uppercase tracking-wider">{lesson.category}</span>
                  <span className="text-[10px] text-l-text-dim">{lesson.difficulty}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mt-3 line-clamp-1 group-hover:text-l-accent-blue transition-colors">{lesson.name}</h3>
                <p className="text-xs text-l-text-dim mt-1 line-clamp-2 leading-relaxed">{lesson.description || 'No description.'}</p>
              </div>
              <div className="pt-3 border-t border-white/[0.06] flex justify-between items-center text-xs">
                <div className="flex gap-1 max-w-[70%] overflow-hidden truncate">
                  {lesson.tags.slice(0, 2).map((t, idx) => (
                    <span key={idx} className="text-[9px] text-l-accent-blue bg-blue-500/10 px-1.5 py-0.5 rounded">#{t}</span>
                  ))}
                </div>
                <span className="text-l-accent-blue font-medium">Study &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-16 border border-dashed border-white/[0.08] rounded-lg">
          <BookOpen size={32} className="text-l-text-dim mb-3" />
          <h3 className="text-sm font-semibold text-l-text-muted">No results</h3>
          <p className="text-xs text-l-text-dim mt-1">Adjust filters to widen search.</p>
        </div>
      )}
    </div>
  );
};
