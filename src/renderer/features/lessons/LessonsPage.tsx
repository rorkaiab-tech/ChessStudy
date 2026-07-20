import React, { useEffect, useState } from 'react';
import { db, Lesson, Chapter, MoveNode } from '../../database/db';
import { useChessStore } from '../../stores/chessStore';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { sound } from '../../services/soundService';
import { Plus, Search, Trash2, X, BookOpen } from 'lucide-react';

export const LessonsPage: React.FC = () => {
  const navigate = useNavigate();
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Openings');
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [pgn, setPgn] = useState('');

  const loadLessons = async () => { setLessons(await db.lessons.toArray()); };
  useEffect(() => { loadLessons().catch(console.error); }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('Delete this study module?')) {
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

    const parsedTags = tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    let startFen = fen.trim() || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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
            notation: executed.san, from: executed.from, to: executed.to,
            fen: nextFen, children: [],
          };
          currentLevel.push(node);
          currentLevel = node.children;
          parentFen = nextFen;
        }
        compiledMoves = rootNodes;
      } catch {
        alert('Invalid PGN. Starting with empty move tree.');
      }
    }

    const firstChapter: Chapter = {
      id: Math.random().toString(36).substring(2, 9),
      name: 'Chapter 1', fen: startFen, moves: compiledMoves,
    };

    const newId = await db.lessons.add({
      name: name.trim(), category, difficulty, description: description.trim(),
      chapters: [firstChapter], isFavorite: 0,
      tags: parsedTags.length > 0 ? parsedTags : ['Custom'], createdAt: Date.now(),
    } as Lesson);

    await db.progress.add({
      lessonId: newId, lastStudiedAt: 0, intervalDays: 0, easeFactor: 2.5,
      repetitions: 0, dueDate: Date.now() + 60000, masteryState: 'new',
    });

    setName(''); setDescription(''); setTags(''); setPgn('');
    setShowCreateModal(false);
    loadLessons();
  };

  const handleStartStudy = (lesson: Lesson) => {
    sound.playSuccess();
    setActiveLesson(lesson);
    navigate(`/lessons/${lesson.id}`);
  };

  const filteredLessons = lessons.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.category.toLowerCase().includes(search.toLowerCase()) ||
      l.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-slide-up flex-1 flex flex-col">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Study Catalog</h1>
          <p className="text-sm text-l-text-muted mt-1.5">Manage your chess study modules.</p>
        </div>
        <button
          onClick={() => { sound.playSuccess(); setShowCreateModal(true); }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-l-accent-blue rounded-md hover:brightness-110 cursor-pointer transition-all"
        >
          <Plus size={14} />Create Lesson
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full">
        <input
          type="text" placeholder="Search lessons..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-l-bg-light border border-white/[0.06] rounded-md px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors text-l-text"
        />
        <Search size={16} className="absolute left-3.5 top-3 text-l-text-dim" />
      </div>

      {/* Grid */}
      {filteredLessons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.map((lesson) => (
            <div
              key={lesson.id}
              onClick={() => handleStartStudy(lesson)}
              className="p-5 rounded-lg bg-l-bg-light border border-white/[0.06] hover:border-white/10 transition-colors flex flex-col justify-between h-[180px] cursor-pointer group"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] bg-white/[0.05] text-l-text-dim font-medium px-2 py-0.5 rounded uppercase tracking-wider">
                    {lesson.category}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, lesson.id!)}
                    className="text-l-text-dim hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-white mt-3 line-clamp-1 group-hover:text-l-accent-blue transition-colors">
                  {lesson.name}
                </h3>
                <p className="text-xs text-l-text-dim mt-1 line-clamp-2 leading-relaxed">
                  {lesson.description || 'No description.'}
                </p>
              </div>
              <div className="pt-3 border-t border-white/[0.06] flex justify-between items-center text-xs">
                <span className="text-l-text-dim font-medium">{lesson.difficulty}</span>
                <span className="text-l-accent-blue font-medium">Open &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-16 border border-dashed border-white/[0.08] rounded-lg">
          <BookOpen size={32} className="text-l-text-dim mb-3" />
          <h3 className="text-sm font-semibold text-l-text-muted">No lessons found</h3>
          <p className="text-xs text-l-text-dim mt-1">Create a lesson to get started.</p>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-l-bg-light border border-white/10 p-6 rounded-lg w-full max-w-2xl shadow-xl flex flex-col gap-5 my-10 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-white/[0.06] pb-3">
              <h2 className="text-base font-semibold text-white">Create Study Lesson</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-l-text-dim hover:text-l-text cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateLesson} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Name</label>
                <input type="text" required placeholder="e.g. Ruy Lopez: Marshall Attack" value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors text-l-text" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors text-l-text">
                    <option value="Openings">Openings</option><option value="Traps">Traps</option>
                    <option value="Middlegame">Middlegame</option><option value="Endgames">Endgames</option>
                    <option value="Lessons">Tactics</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Difficulty</label>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}
                    className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors text-l-text">
                    <option value="Beginner">Beginner</option><option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Tags</label>
                  <input type="text" placeholder="gambit, sacrifice, endgame" value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors text-l-text" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Starting FEN</label>
                  <input type="text" placeholder="Default start position" value={fen}
                    onChange={(e) => setFen(e.target.value)}
                    className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors text-l-text font-mono" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Description</label>
                <textarea placeholder="Brief summary..." value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors h-20 resize-none text-l-text" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Import PGN</label>
                <textarea placeholder="Paste PGN main line..." value={pgn}
                  onChange={(e) => setPgn(e.target.value)}
                  className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors h-20 font-mono resize-none text-l-text" />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-l-text-dim hover:text-l-text cursor-pointer">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-l-accent-blue rounded-md hover:brightness-110 cursor-pointer transition-all">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
