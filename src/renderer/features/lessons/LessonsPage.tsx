import React, { useEffect, useState } from 'react';
import { db, Lesson, Chapter, MoveNode } from '../../database/db';
import { useChessStore, useSettingsStore } from '../../stores/chessStore';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { sound } from '../../services/soundService';

export const LessonsPage: React.FC = () => {
  const navigate = useNavigate();
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);
  const { accentColor } = useSettingsStore();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New lesson form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Openings');
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [pgn, setPgn] = useState('');

  const loadLessons = async () => {
    const list = await db.lessons.toArray();
    setLessons(list);
  };

  useEffect(() => {
    loadLessons().catch((err) => console.error('Load lessons failed:', err));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this study module?')) {
      sound.playError();
      await db.lessons.delete(id);
      await db.progress.delete(id);
      loadLessons();
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    sound.playSuccess();
    
    // Parse tags
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Initial FEN validation
    let startFen = fen.trim();
    if (!startFen) {
      startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }

    // Build root moves list (either empty or parsed from PGN main line)
    let compiledMoves: MoveNode[] = [];
    if (pgn.trim()) {
      try {
        const game = new Chess();
        game.loadPgn(pgn.trim());
        const history = game.history({ verbose: true });
        
        let parentFen = startFen;
        const rootNodes: MoveNode[] = [];
        let currentLevel = rootNodes;
        
        for (const m of history) {
          const moveChess = new Chess(parentFen);
          const executed = moveChess.move({ from: m.from, to: m.to, promotion: m.promotion });
          const nextFen = moveChess.fen();
          const node: MoveNode = {
            id: Math.random().toString(36).substring(2, 9),
            notation: executed.san,
            from: executed.from,
            to: executed.to,
            fen: nextFen,
            children: [],
          };
          currentLevel.push(node);
          currentLevel = node.children;
          parentFen = nextFen;
        }
        compiledMoves = rootNodes;
      } catch (err) {
        alert('Invalid PGN formatting. Main line was not imported. Starting with empty move tree.');
        compiledMoves = [];
      }
    }

    const firstChapter: Chapter = {
      id: Math.random().toString(36).substring(2, 9),
      name: 'Chapter 1: Theory',
      fen: startFen,
      moves: compiledMoves,
    };

    const newLesson: Omit<Lesson, 'id'> = {
      name: name.trim(),
      category,
      difficulty,
      description: description.trim(),
      chapters: [firstChapter],
      isFavorite: 0,
      tags: parsedTags.length > 0 ? parsedTags : ['Custom'],
      createdAt: Date.now(),
    };

    const newId = await db.lessons.add(newLesson as Lesson);
    // Initialize spacing interval
    await db.progress.add({
      lessonId: newId,
      lastStudiedAt: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      dueDate: Date.now() + 1000 * 60,
      masteryState: 'new',
    });

    // Reset Form
    setName('');
    setDescription('');
    setTags('');
    setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setPgn('');
    setShowCreateModal(false);
    loadLessons();
  };

  const handleStartStudy = (lesson: Lesson) => {
    sound.playSuccess();
    setActiveLesson(lesson);
    navigate(`/lessons/${lesson.id}`);
  };

  // Filter lessons
  const filteredLessons = lessons.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.category.toLowerCase().includes(search.toLowerCase()) ||
      l.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  // CSS themes matching settings
  const bgAccent = {
    emerald: 'bg-emerald-500 hover:bg-emerald-600',
    blue: 'bg-blue-500 hover:bg-blue-600',
    amber: 'bg-amber-500 hover:bg-amber-600',
    rose: 'bg-rose-500 hover:bg-rose-600',
    indigo: 'bg-indigo-500 hover:bg-indigo-600',
  }[accentColor];

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

  return (
    <div className="space-y-8 animate-fade-in flex-1 flex flex-col">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Study Catalog</h1>
          <p className="text-sm text-gray-400 mt-2">
            Organize and manage your custom chess repositories. Build chapters, write comments, and practice.
          </p>
        </div>
        <button
          onClick={() => {
            sound.playSuccess();
            setShowCreateModal(true);
          }}
          className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl cursor-pointer shadow-lg transition duration-200 ${bgAccent}`}
        >
          + Create Custom Lesson
        </button>
      </div>

      {/* Search Input Filter bar */}
      <div className="relative w-full">
        <input
          type="text"
          placeholder="Search by lesson name, category, or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0f1216] border border-white/5 rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-indigo-500 transition duration-150 text-gray-200"
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

      {/* Grid of Lessons */}
      {filteredLessons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => (
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
                  <button
                    onClick={(e) => handleDelete(e, lesson.id!)}
                    className="text-gray-500 hover:text-red-400 hover:bg-white/5 p-1 rounded-lg transition text-xs cursor-pointer"
                    title="Delete Lesson"
                  >
                    🗑️
                  </button>
                </div>
                <h3 className="text-sm font-bold text-gray-200 mt-3 line-clamp-1 group-hover:text-white transition">
                  {lesson.name}
                </h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                  {lesson.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                <span className="text-gray-500 font-semibold">{lesson.difficulty}</span>
                <span className={`${textAccent} font-bold`}>Open Study &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-[#0f1216]/40 border border-dashed border-white/5 rounded-2xl">
          <span className="text-5xl mb-4">📂</span>
          <h3 className="text-lg font-bold text-gray-300">No Lessons Found</h3>
          <p className="text-sm text-gray-500 mt-1">Try resetting your search query or create a custom lesson.</p>
        </div>
      )}

      {/* CREATE LESSON MODAL */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-[#12141a] border border-white/10 p-6 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col gap-5 my-10 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h2 className="text-lg font-bold text-gray-200">Create Custom Study Lesson</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateLesson} className="space-y-4">
              {/* Lesson Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Lesson Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ruy Lopez: Marshall Attack"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-[#0f1216] border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition text-gray-200"
                />
              </div>

              {/* Category & Difficulty */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-[#0f1216] border border-white/5 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition text-gray-200"
                  >
                    <option value="Openings">Openings</option>
                    <option value="Traps">Opening Traps</option>
                    <option value="Middlegame">Middlegame Ideas</option>
                    <option value="Endgames">Endgames</option>
                    <option value="Lessons">Tactics / Lessons</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="bg-[#0f1216] border border-white/5 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition text-gray-200"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Tags & Starting FEN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tags (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. gambit, sacrifice, rook-endgame"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="bg-[#0f1216] border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition text-gray-200"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Starting FEN (optional)</label>
                  <input
                    type="text"
                    placeholder="Defaults to standard starting position FEN"
                    value={fen}
                    onChange={(e) => setFen(e.target.value)}
                    className="bg-[#0f1216] border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition text-gray-200 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Description</label>
                <textarea
                  placeholder="Enter a brief summary of what this study will focus on..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-[#0f1216] border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition h-20 resize-none text-gray-200"
                />
              </div>

              {/* Import PGN */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Import PGN Main Line (optional)</label>
                  <span className="text-[10px] text-gray-500 italic">e.g. 1. e4 e5 2. Nf3 Nc6 3. Bb5</span>
                </div>
                <textarea
                  placeholder="Paste your PGN text here. The main line moves will compile automatically..."
                  value={pgn}
                  onChange={(e) => setPgn(e.target.value)}
                  className="bg-[#0f1216] border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition h-24 font-mono resize-none text-gray-200"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl cursor-pointer shadow-lg transition duration-200 ${bgAccent}`}
                >
                  Create Study Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
