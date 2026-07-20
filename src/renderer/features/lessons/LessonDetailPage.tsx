import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, Lesson, Chapter, MoveNode } from '../../database/db';
import { useChessStore, useSettingsStore, InteractiveMode } from '../../stores/chessStore';
import { ChessBoard } from '../../components/chess/ChessBoard';
import { MoveTreeUI } from '../../components/chess/MoveTreeUI';
import { sound } from '../../services/soundService';
import { RotateCw, ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const LessonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const activeLesson = useChessStore((s) => s.activeLesson);
  const activeChapterIndex = useChessStore((s) => s.activeChapterIndex);
  const activeNode = useChessStore((s) => s.activeNode);
  const currentFen = useChessStore((s) => s.currentFen);
  const boardOrientation = useChessStore((s) => s.boardOrientation);
  const interactiveMode = useChessStore((s) => s.interactiveMode);
  const arrows = useChessStore((s) => s.arrows);
  const circles = useChessStore((s) => s.circles);
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);
  const setActiveChapterIndex = useChessStore((s) => s.setActiveChapterIndex);
  const selectNode = useChessStore((s) => s.selectNode);
  const flipBoard = useChessStore((s) => s.flipBoard);
  const setInteractiveMode = useChessStore((s) => s.setInteractiveMode);
  const initPracticeMode = useChessStore((s) => s.initPracticeMode);
  const practiceState = useChessStore((s) => s.practiceState);
  const practiceFeedback = useChessStore((s) => s.practiceFeedback);
  const quizIndex = useChessStore((s) => s.quizIndex);
  const quizTotal = useChessStore((s) => s.quizTotal);
  const quizCorrectCount = useChessStore((s) => s.quizCorrectCount);
  const quizCompleted = useChessStore((s) => s.quizCompleted);
  const quizQuestion = useChessStore((s) => s.quizQuestion);

  const [loading, setLoading] = useState(true);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterFen, setNewChapterFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  useEffect(() => {
    const fetchLesson = async () => {
      if (!id) return;
      setLoading(true);
      const lesson = await db.lessons.get(parseInt(id, 10));
      if (lesson) setActiveLesson(lesson, 0);
      else navigate('/lessons');
      setLoading(false);
    };
    fetchLesson().catch(console.error);
    return () => { setActiveLesson(null); setInteractiveMode('theory'); };
  }, [id]);

  if (loading || !activeLesson) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-l-accent-blue/20 border-t-l-accent-blue animate-spin" />
      </div>
    );
  }

  const chapter = activeLesson.chapters[activeChapterIndex] || activeLesson.chapters[0];

  const handleJumpStart = () => { sound.playHover(); selectNode(null); };
  const handleJumpEnd = () => {
    sound.playHover();
    if (chapter.moves.length === 0) return;
    let node = chapter.moves[0];
    while (node.children.length > 0) node = node.children[0];
    selectNode(node);
  };

  const findParentNode = (nodes: MoveNode[], targetId: string, parent: MoveNode | null = null): MoveNode | null => {
    for (const node of nodes) {
      if (node.id === targetId) return parent;
      const found = findParentNode(node.children, targetId, node);
      if (found) return found;
    }
    return null;
  };

  const handleStepBack = () => {
    sound.playHover();
    if (!activeNode) return;
    selectNode(findParentNode(chapter.moves, activeNode.id));
  };

  const handleStepForward = () => {
    sound.playHover();
    if (!activeNode) { if (chapter.moves.length > 0) selectNode(chapter.moves[0]); }
    else if (activeNode.children.length > 0) selectNode(activeNode.children[0]);
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterName.trim()) return;
    sound.playSuccess();
    const newCh: Chapter = {
      id: Math.random().toString(36).substring(2, 9),
      name: newChapterName.trim(),
      fen: newChapterFen.trim() || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: [],
    };
    const updated = { ...activeLesson, chapters: [...activeLesson.chapters, newCh] };
    await db.lessons.put(updated);
    setActiveLesson(updated, updated.chapters.length - 1);
    setNewChapterName(''); setShowAddChapter(false);
  };

  const handleDeleteChapter = async (idx: number) => {
    if (activeLesson.chapters.length <= 1) { alert('Must have at least one chapter.'); return; }
    if (confirm('Delete this chapter?')) {
      sound.playError();
      const updated = { ...activeLesson, chapters: activeLesson.chapters.filter((_, i) => i !== idx) };
      await db.lessons.put(updated);
      setActiveLesson(updated, 0);
    }
  };

  const saveHighlightsToMove = async () => {
    if (!activeNode) return;
    sound.playSuccess();
    const saveInTree = (list: MoveNode[]): boolean => {
      const idx = list.findIndex((n) => n.id === activeNode.id);
      if (idx !== -1) { list[idx].arrows = arrows; list[idx].circles = circles; return true; }
      for (const node of list) { if (saveInTree(node.children)) return true; }
      return false;
    };
    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    saveInTree(updated.chapters[activeChapterIndex].moves);
    await db.lessons.put(updated);
    setActiveLesson(updated, activeChapterIndex);
  };

  const copyFenToClipboard = () => { sound.playSuccess(); navigator.clipboard.writeText(currentFen); };
  const handlePasteFen = () => {
    const input = prompt('Paste FEN string:');
    if (!input || input.trim().split(' ').length < 4) return;
    sound.playSuccess();
    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    updated.chapters[activeChapterIndex].fen = input.trim();
    updated.chapters[activeChapterIndex].moves = [];
    db.lessons.put(updated).then(() => setActiveLesson(updated, activeChapterIndex));
  };

  const btnClass = "px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-xs font-medium text-l-text transition-colors cursor-pointer";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-stretch animate-slide-up">
      {/* LEFT: Board */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center">
        <div className="w-full flex justify-between items-center mb-3 gap-3">
          <div className="flex items-center gap-2 max-w-[60%]">
            <span className="text-[10px] bg-white/[0.05] text-l-accent-blue px-2 py-0.5 rounded font-mono">Chapter</span>
            <select
              value={activeChapterIndex}
              onChange={(e) => { sound.playHover(); setActiveChapterIndex(parseInt(e.target.value, 10)); }}
              className="bg-l-bg-light border border-white/[0.06] rounded-md px-2 py-1 text-xs text-l-text focus:outline-none max-w-[200px]"
            >
              {activeLesson.chapters.map((ch, idx) => (
                <option key={ch.id} value={idx}>{ch.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => { sound.playHover(); flipBoard(); }} className={btnClass} title="Flip board">
              <RotateCw size={14} />
            </button>
            <button onClick={() => navigate('/lessons')} className={btnClass}>
              <ArrowLeft size={14} className="inline mr-1" />Back
            </button>
          </div>
        </div>

        <ChessBoard />

        {/* Navigation */}
        <div className="flex justify-center items-center gap-2 mt-3 bg-l-bg-light border border-white/[0.06] px-4 py-2 rounded-md">
          <button onClick={handleJumpStart} className="text-l-text-dim hover:text-white transition-colors p-1.5 rounded hover:bg-white/[0.06] cursor-pointer" title="Start"><ChevronsLeft size={16} /></button>
          <button onClick={handleStepBack} className="text-l-text-dim hover:text-white transition-colors p-1.5 rounded hover:bg-white/[0.06] cursor-pointer" title="Back"><ChevronLeft size={16} /></button>
          <button onClick={handleStepForward} className="text-l-text-dim hover:text-white transition-colors p-1.5 rounded hover:bg-white/[0.06] cursor-pointer" title="Forward"><ChevronRight size={16} /></button>
          <button onClick={handleJumpEnd} className="text-l-text-dim hover:text-white transition-colors p-1.5 rounded hover:bg-white/[0.06] cursor-pointer" title="End"><ChevronsRight size={16} /></button>
        </div>
      </div>

      {/* RIGHT: Panel */}
      <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
        <div className="space-y-5 flex-1 flex flex-col">
          {/* Mode tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-l-bg-light border border-white/[0.06] rounded-md">
            {(['theory', 'practice', 'quiz', 'edit'] as InteractiveMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { sound.playHover(); setInteractiveMode(mode); }}
                className={`py-1.5 text-[10px] font-semibold rounded uppercase tracking-wider transition-colors cursor-pointer ${
                  interactiveMode === mode
                    ? 'bg-l-accent-blue text-white'
                    : 'text-l-text-dim hover:text-l-text'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <MoveTreeUI />

          {/* Mode-specific panel */}
          <div className="flex-1 flex flex-col justify-between">
            {interactiveMode === 'theory' && (
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider mb-2">Notes</h4>
                  <div className="text-sm text-l-text leading-relaxed max-h-[140px] overflow-y-auto custom-scrollbar">
                    {activeNode?.comment ? `"${activeNode.comment}"` : (
                      <span className="text-l-text-dim italic text-xs">No notes. Use Editor to add comments.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {interactiveMode === 'practice' && (
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider mb-2">Practice</h4>
                  <p className="text-sm text-l-text leading-relaxed">{practiceFeedback}</p>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                  <button onClick={() => { sound.playHover(); initPracticeMode(); }}
                    className="flex-1 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-xs font-medium text-l-text transition-colors cursor-pointer">Reset</button>
                  <button onClick={() => {
                    sound.playSuccess();
                    const expected = useChessStore.getState().practiceExpectedNodes[0];
                    if (expected) useChessStore.setState({ practiceFeedback: `Hint: Move from ${expected.from}!` });
                  }} className="flex-1 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-xs font-medium text-l-text transition-colors cursor-pointer">Hint</button>
                </div>
              </div>
            )}

            {interactiveMode === 'quiz' && (
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg flex-1 flex flex-col justify-between">
                {quizCompleted ? (
                  <div className="text-center py-6 space-y-3">
                    <span className="text-3xl">🎉</span>
                    <h3 className="text-sm font-semibold text-l-accent-green">Quiz Complete!</h3>
                    <p className="text-xs text-l-text-dim">{quizCorrectCount} of {quizTotal} correct.</p>
                    <button onClick={() => { sound.playSuccess(); setInteractiveMode('quiz'); }}
                      className="px-4 py-2 text-xs font-medium text-white bg-l-accent-blue rounded-md cursor-pointer">Play Again</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Guess the Move</h4>
                        <span className="text-[10px] font-medium text-l-text-dim">{quizIndex + 1}/{quizTotal}</span>
                      </div>
                      <p className="text-sm text-l-text leading-relaxed">{quizQuestion}</p>
                    </div>
                    <button onClick={() => { sound.playHover(); useChessStore.getState().nextQuizQuestion(); }}
                      className="w-full py-2 mt-3 text-xs font-medium text-white bg-l-accent-blue rounded-md cursor-pointer">Next &rarr;</button>
                  </>
                )}
              </div>
            )}

            {interactiveMode === 'edit' && (
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg flex-1 flex flex-col gap-3">
                <div>
                  <h4 className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider mb-1">Editor</h4>
                  <span className="text-[10px] text-l-text-dim">Make moves to insert variations. Right-click draws arrows & circles.</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={saveHighlightsToMove} disabled={!activeNode}
                    className="py-2 bg-green-500/10 hover:bg-green-500/15 border border-green-500/20 rounded-md text-[10px] font-semibold text-green-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-center">Save Highlights</button>
                  <button onClick={handlePasteFen}
                    className="py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-[10px] font-semibold text-l-text-dim transition-colors cursor-pointer text-center">Paste FEN</button>
                  <button onClick={copyFenToClipboard}
                    className="py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md text-[10px] font-semibold text-l-text-dim transition-colors cursor-pointer text-center">Copy FEN</button>
                  <button onClick={() => handleDeleteChapter(activeChapterIndex)}
                    className="py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-md text-[10px] font-semibold text-red-400 transition-colors cursor-pointer text-center">Delete Chapter</button>
                </div>
                <button onClick={() => { sound.playHover(); setShowAddChapter(true); }}
                  className="w-full py-2 mt-1 text-xs font-medium text-white bg-l-accent-blue rounded-md cursor-pointer text-center">+ Add Chapter</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD CHAPTER MODAL */}
      {showAddChapter && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-l-bg-light border border-white/10 p-5 rounded-lg w-full max-w-md shadow-xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
              <h3 className="text-sm font-semibold text-white">Add Chapter</h3>
              <button onClick={() => setShowAddChapter(false)} className="text-l-text-dim hover:text-l-text text-xs cursor-pointer">Cancel</button>
            </div>
            <form onSubmit={handleAddChapter} className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Name</label>
                <input type="text" required placeholder="Chapter name" value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 text-l-text" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-l-text-dim uppercase tracking-wider">Starting FEN</label>
                <input type="text" placeholder="Default start" value={newChapterFen}
                  onChange={(e) => setNewChapterFen(e.target.value)}
                  className="bg-l-bg border border-white/[0.06] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-l-accent-blue/50 text-l-text font-mono" />
              </div>
              <button type="submit" className="w-full py-2 text-xs font-medium text-white bg-l-accent-blue rounded-md cursor-pointer">Create Chapter</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
