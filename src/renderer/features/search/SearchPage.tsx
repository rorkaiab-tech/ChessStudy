import React, { useEffect, useState } from 'react';
import { db, Lesson } from '../../database/db';
import { useChessStore, useSettingsStore } from '../../stores/chessStore';
import { useNavigate } from 'react-router-dom';
import { sound } from '../../services/soundService';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);
  const { accentColor } = useSettingsStore();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [query, setQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // List of standard chess tags
  const popularTags = [
    'Opening', 'Najdorf', 'Ruy Lopez', 'Tactics', 'Trap', 'Fork', 'Pin',
    'Skewer', 'Discovered Attack', 'Sacrifice', 'Mate', 'Defense',
    'Counterattack', 'Initiative', 'Passed Pawn', 'Rook Endgame', 'Lucena'
  ];

  useEffect(() => {
    db.lessons.toArray().then((list) => setLessons(list));
  }, []);

  const handleTagToggle = (tag: string) => {
    sound.playHover();
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleStartStudy = (lesson: Lesson) => {
    sound.playSuccess();
    setActiveLesson(lesson);
    navigate(`/lessons/${lesson.id}`);
  };

  // Filtering calculations
  const filtered = lessons.filter((lesson) => {
    // 1. Text Query
    const textMatch =
      lesson.name.toLowerCase().includes(query.toLowerCase()) ||
      lesson.description.toLowerCase().includes(query.toLowerCase()) ||
      lesson.category.toLowerCase().includes(query.toLowerCase());

    // 2. Difficulty
    const diffMatch = selectedDifficulty === 'All' || lesson.difficulty === selectedDifficulty;

    // 3. Category
    const catMatch = selectedCategory === 'All' || lesson.category === selectedCategory;

    // 4. Tags
    const tagsMatch =
      activeTags.length === 0 || activeTags.every((t) => lesson.tags.includes(t));

    return textMatch && diffMatch && catMatch && tagsMatch;
  });

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

  return (
    <div className="space-y-8 animate-fade-in flex-1 flex flex-col">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Search & Discovery</h1>
        <p className="text-sm text-gray-400 mt-2">
          Query your chess study databases instantaneously using combinations of categories, difficulties, and positional motifs.
        </p>
      </div>

      {/* Search Input bar */}
      <div className="relative w-full">
        <input
          type="text"
          placeholder="Filter by name, description, category..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-[#0f1216] border border-white/5 rounded-xl px-4 py-3.5 pl-10 text-sm focus:outline-none focus:border-indigo-500 transition duration-150 text-gray-200"
        />
        <svg
          className="w-5 h-5 absolute left-3.5 top-3.5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Filter Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category filters */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category Filter</label>
          <div className="flex flex-wrap gap-2">
            {['All', 'Openings', 'Traps', 'Middlegame', 'Endgames', 'Lessons'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  sound.playHover();
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  selectedCategory === cat
                    ? `${bgAccent} text-white border-transparent`
                    : 'bg-white/5 border-white/5 text-gray-400 hover:text-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty filters */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Difficulty Filter</label>
          <div className="flex flex-wrap gap-2">
            {['All', 'Beginner', 'Intermediate', 'Advanced'].map((diff) => (
              <button
                key={diff}
                onClick={() => {
                  sound.playHover();
                  setSelectedDifficulty(diff);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  selectedDifficulty === diff
                    ? `${bgAccent} text-white border-transparent`
                    : 'bg-white/5 border-white/5 text-gray-400 hover:text-gray-200'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Popular motifs tags */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Filter by Motif/Tag</label>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => {
            const isActive = activeTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`px-2.5 py-1 rounded-full text-xs transition cursor-pointer ${
                  isActive
                    ? `${bgAccent} text-white font-medium scale-[1.03]`
                    : 'bg-white/[0.02] hover:bg-white/[0.06] text-gray-400 border border-white/5'
                }`}
              >
                {tag} {isActive ? '✕' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Title count */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Results ({filtered.length})</span>
        {activeTags.length > 0 && (
          <button
            onClick={() => {
              sound.playError();
              setActiveTags([]);
            }}
            className="text-[10px] font-semibold text-red-400 hover:underline"
          >
            Clear Active Tags
          </button>
        )}
      </div>

      {/* Filtered grid catalog */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
          {filtered.map((lesson) => (
            <div
              key={lesson.id}
              onClick={() => handleStartStudy(lesson)}
              className={`p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.01] border ${borderHighlight} shadow-xl hover:shadow-2xl transition duration-200 flex flex-col justify-between h-[200px] cursor-pointer group`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[9px] bg-white/5 text-gray-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {lesson.category}
                  </span>
                  <span className="text-[9px] text-gray-500 font-semibold">{lesson.difficulty}</span>
                </div>
                <h3 className="text-sm font-bold text-gray-200 mt-3 line-clamp-1 group-hover:text-white transition">
                  {lesson.name}
                </h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                  {lesson.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                <div className="flex flex-wrap gap-1 max-w-[70%] overflow-hidden truncate">
                  {lesson.tags.slice(0, 2).map((t, idx) => (
                    <span key={idx} className="text-[9px] text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5 rounded">
                      #{t}
                    </span>
                  ))}
                </div>
                <span className={`${textAccent} font-bold`}>Open Study &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-[#0f1216]/40 border border-dashed border-white/5 rounded-2xl">
          <span className="text-4xl mb-4">🔍</span>
          <h3 className="text-base font-bold text-gray-300">No Match Found</h3>
          <p className="text-xs text-gray-500 mt-1">Adjust search parameters or tags combinations to widen search criteria.</p>
        </div>
      )}
    </div>
  );
};
