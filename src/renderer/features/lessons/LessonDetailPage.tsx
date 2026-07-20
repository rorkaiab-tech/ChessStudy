import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, Lesson, Chapter, MoveNode } from '../../database/db';
import { useChessStore, useSettingsStore, InteractiveMode } from '../../stores/chessStore';
import { ChessBoard } from '../../components/chess/ChessBoard';
import { MoveTreeUI } from '../../components/chess/MoveTreeUI';
import { sound } from '../../services/soundService';

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

  // Practice state
  const practiceState = useChessStore((s) => s.practiceState);
  const practiceFeedback = useChessStore((s) => s.practiceFeedback);

  // Quiz state
  const quizIndex = useChessStore((s) => s.quizIndex);
  const quizTotal = useChessStore((s) => s.quizTotal);
  const quizCorrectCount = useChessStore((s) => s.quizCorrectCount);
  const quizCompleted = useChessStore((s) => s.quizCompleted);
  const quizQuestion = useChessStore((s) => s.quizQuestion);

  const { accentColor } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterFen, setNewChapterFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  // Load lesson from Dexie
  useEffect(() => {
    const fetchLesson = async () => {
      if (!id) return;
      setLoading(true);
      const lesson = await db.lessons.get(parseInt(id, 10));
      if (lesson) {
        setActiveLesson(lesson, 0);
      } else {
        navigate('/lessons');
      }
      setLoading(false);
    };

    fetchLesson().catch((err) => console.error('Failed to load lesson:', err));

    return () => {
      setActiveLesson(null);
      setInteractiveMode('theory');
    };
  }, [id]);

  if (loading || !activeLesson) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  const chapter = activeLesson.chapters[activeChapterIndex] || activeLesson.chapters[0];

  // ------------------------------------------
  // Board Navigation helpers
  // ------------------------------------------
  const handleJumpStart = () => {
    sound.playHover();
    selectNode(null);
  };

  const handleJumpEnd = () => {
    sound.playHover();
    if (chapter.moves.length === 0) return;
    let node = chapter.moves[0];
    while (node.children.length > 0) {
      node = node.children[0];
    }
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
    const parent = findParentNode(chapter.moves, activeNode.id);
    selectNode(parent);
  };

  const handleStepForward = () => {
    sound.playHover();
    if (!activeNode) {
      if (chapter.moves.length > 0) selectNode(chapter.moves[0]);
    } else if (activeNode.children.length > 0) {
      selectNode(activeNode.children[0]);
    }
  };

  // ------------------------------------------
  // Chapter management
  // ------------------------------------------
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

    const updatedLesson = {
      ...activeLesson,
      chapters: [...activeLesson.chapters, newCh],
    };

    await db.lessons.put(updatedLesson);
    setActiveLesson(updatedLesson, updatedLesson.chapters.length - 1);
    setNewChapterName('');
    setNewChapterFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setShowAddChapter(false);
  };

  const handleDeleteChapter = async (idx: number) => {
    if (activeLesson.chapters.length <= 1) {
      alert('A study module must have at least one chapter.');
      return;
    }
    if (confirm('Are you sure you want to delete this chapter?')) {
      sound.playError();
      const updatedChapters = activeLesson.chapters.filter((_, i) => i !== idx);
      const updatedLesson = { ...activeLesson, chapters: updatedChapters };
      await db.lessons.put(updatedLesson);
      setActiveLesson(updatedLesson, 0);
    }
  };

  // ------------------------------------------
  // Editor operations
  // ------------------------------------------
  const saveHighlightsToMove = async () => {
    if (!activeNode) return;
    sound.playSuccess();

    const saveInTree = (list: MoveNode[]): boolean => {
      const idx = list.findIndex((n) => n.id === activeNode.id);
      if (idx !== -1) {
        list[idx].arrows = arrows;
        list[idx].circles = circles;
        return true;
      }
      for (const node of list) {
        if (saveInTree(node.children)) return true;
      }
      return false;
    };

    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    const ch = updated.chapters[activeChapterIndex];
    saveInTree(ch.moves);
    await db.lessons.put(updated);
    setActiveLesson(updated, activeChapterIndex);
  };

  const copyFenToClipboard = () => {
    sound.playSuccess();
    navigator.clipboard.writeText(currentFen);
    alert('FEN position copied to clipboard!');
  };

  const copyPgnToClipboard = () => {
    sound.playSuccess();
    // Build simple PGN representation from move tree
    const compilePgnString = (nodes: MoveNode[]): string => {
      if (nodes.length === 0) return '';
      let out = '';
      nodes.forEach((n, idx) => {
        const turn = n.fen.split(' ')[1] === 'b'; // played by white
        const moveNum = n.fen.split(' ')[5];
        if (turn) out += `${moveNum}. ${n.notation} `;
        else out += `${n.notation} `;

        if (n.comment) out += `{ ${n.comment} } `;
        
        // Variations
        if (n.children.length > 1) {
          n.children.slice(1).forEach(alt => {
            out += `(${compilePgnString([alt])}) `;
          });
        }

        if (n.children.length > 0) {
          out += compilePgnString([n.children[0]]);
        }
      });
      return out.trim();
    };

    const pgnStr = compilePgnString(chapter.moves);
    navigator.clipboard.writeText(pgnStr);
    alert('PGN game notation copied to clipboard!');
  };

  const handlePasteFen = () => {
    const input = prompt('Paste FEN string:');
    if (!input) return;
    
    // Simple FEN validation check
    const parts = input.trim().split(' ');
    if (parts.length < 4) {
      alert('Invalid FEN formatting.');
      return;
    }
    
    sound.playSuccess();
    // Update starting FEN of chapter
    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    updated.chapters[activeChapterIndex].fen = input.trim();
    updated.chapters[activeChapterIndex].moves = []; // Clear current tree since starter changed
    db.lessons.put(updated).then(() => {
      setActiveLesson(updated, activeChapterIndex);
    });
  };

  // Color helper mappings
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-stretch animate-fade-in">
      {/* 1. LEFT SIDE: CHESS BOARD VIEWPORT (7 columns) */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center">
        {/* Chapter Header Selection */}
        <div className="w-full flex justify-between items-center mb-4 gap-4">
          <div className="flex items-center gap-2 max-w-[60%]">
            <span className="text-[10px] bg-white/5 text-indigo-400 px-2 py-0.5 rounded font-mono select-none">
              Chapter
            </span>
            <select
              value={activeChapterIndex}
              onChange={(e) => {
                sound.playHover();
                setActiveChapterIndex(parseInt(e.target.value, 10));
              }}
              className="bg-[#0f1216] border border-white/5 rounded-xl px-2 py-1 text-xs text-gray-200 focus:outline-none max-w-[200px]"
            >
              {activeLesson.chapters.map((ch, idx) => (
                <option key={ch.id} value={idx}>
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => {
                sound.playHover();
                flipBoard();
              }}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-semibold text-gray-300 transition cursor-pointer"
              title="Flip Board Orientation"
            >
              F
            </button>
            <button
              onClick={() => navigate('/lessons')}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-semibold text-gray-300 transition cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>

        {/* Board container */}
        <ChessBoard />

        {/* Board navigation buttons */}
        <div className="flex justify-center items-center gap-3 mt-4 bg-[#0f1216] border border-white/5 px-6 py-2.5 rounded-full shadow-lg">
          <button
            onClick={handleJumpStart}
            className="text-gray-400 hover:text-white transition font-bold font-mono px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-sm cursor-pointer"
            title="Jump to start position"
          >
            &lt;&lt;
          </button>
          <button
            onClick={handleStepBack}
            className="text-gray-400 hover:text-white transition font-bold font-mono px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-sm cursor-pointer"
            title="Step backward"
          >
            &lt;
          </button>
          <button
            onClick={handleStepForward}
            className="text-gray-400 hover:text-white transition font-bold font-mono px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-sm cursor-pointer"
            title="Step forward"
          >
            &gt;
          </button>
          <button
            onClick={handleJumpEnd}
            className="text-gray-400 hover:text-white transition font-bold font-mono px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-sm cursor-pointer"
            title="Jump to end of line"
          >
            &gt;&gt;
          </button>
        </div>
      </div>

      {/* 2. RIGHT SIDE: STUDY WORKSPACE PANEL (5 columns) */}
      <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
        <div className="space-y-6 flex-1 flex flex-col">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-[#0f1216] border border-white/5 rounded-xl">
            {(['theory', 'practice', 'quiz', 'edit'] as InteractiveMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  sound.playHover();
                  setInteractiveMode(mode);
                }}
                className={`py-2 text-[10px] font-bold rounded-lg uppercase tracking-wider transition cursor-pointer ${
                  interactiveMode === mode
                    ? `${bgAccent} text-white`
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Move tree Notation List (Always visible to help keep context) */}
          <MoveTreeUI />

          {/* Mode-Specific Sidebar Card */}
          <div className="flex-1 flex flex-col justify-between">
            {/* THEORY MODE */}
            {interactiveMode === 'theory' && (
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Position Notes</h4>
                  <div className="text-sm font-semibold text-gray-200 leading-relaxed max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                    {activeNode?.comment ? (
                      `"${activeNode.comment}"`
                    ) : (
                      <span className="text-gray-500 italic">No notes written for this move. Double click or enter Editor mode to add comments.</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 text-[10px] text-gray-500">
                  Click moves in the tree or use arrows to navigate the theory line.
                </div>
              </div>
            )}

            {/* PRACTICE MODE */}
            {interactiveMode === 'practice' && (
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Interactive Practice</h4>
                  <p className="text-sm font-semibold text-gray-200 leading-relaxed">
                    {practiceFeedback}
                  </p>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                  <button
                    onClick={() => {
                      sound.playHover();
                      initPracticeMode();
                    }}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-gray-400 transition cursor-pointer"
                  >
                    Reset Board
                  </button>
                  <button
                    onClick={() => {
                      sound.playSuccess();
                      const expected = useChessStore.getState().practiceExpectedNodes[0];
                      if (expected) {
                        useChessStore.setState({
                          practiceFeedback: `Hint: A piece moves from ${expected.from}!`,
                        });
                      }
                    }}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-gray-400 transition cursor-pointer"
                  >
                    Get Hint
                  </button>
                </div>
              </div>
            )}

            {/* QUIZ MODE */}
            {interactiveMode === 'quiz' && (
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex-1 flex flex-col justify-between">
                {quizCompleted ? (
                  <div className="text-center py-6 space-y-4">
                    <span className="text-4xl">🎉</span>
                    <h3 className="text-sm font-bold text-green-400">Quiz Completed!</h3>
                    <p className="text-xs text-gray-400">
                      You solved {quizCorrectCount} of {quizTotal} questions correctly!
                    </p>
                    <button
                      onClick={() => {
                        sound.playSuccess();
                        setInteractiveMode('quiz');
                      }}
                      className={`px-4 py-2 text-xs font-bold text-white rounded-xl cursor-pointer ${bgAccent}`}
                    >
                      Play Again
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Guess the Move</h4>
                        <span className="text-[10px] font-bold text-gray-400">
                          {quizIndex + 1} / {quizTotal}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-200 leading-relaxed mb-4">
                        {quizQuestion}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        sound.playHover();
                        useChessStore.getState().nextQuizQuestion();
                      }}
                      className={`w-full py-2.5 text-xs font-bold text-white rounded-xl cursor-pointer shadow transition ${bgAccent}`}
                    >
                      Next Question &rarr;
                    </button>
                  </>
                )}
              </div>
            )}

            {/* EDITOR MODE */}
            {interactiveMode === 'edit' && (
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex-1 flex flex-col gap-4">
                <div className="flex flex-col">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Visual Study Editor</h4>
                  <span className="text-[10px] text-gray-500 leading-relaxed">
                    Make moves to insert variations. Right-click drag draws green arrows. Right-click tap highlights red circles.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={saveHighlightsToMove}
                    disabled={!activeNode}
                    className="py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl text-[10px] font-bold text-green-400 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-center"
                    title="Saves drawn arrows and circles to the active move node"
                  >
                    💾 Save Highlights
                  </button>
                  <button
                    onClick={handlePasteFen}
                    className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-bold text-gray-400 transition cursor-pointer text-center"
                  >
                    📋 Paste Starting FEN
                  </button>
                  <button
                    onClick={copyFenToClipboard}
                    className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-bold text-gray-400 transition cursor-pointer text-center"
                  >
                    📄 Copy Current FEN
                  </button>
                  <button
                    onClick={copyPgnToClipboard}
                    className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-bold text-gray-400 transition cursor-pointer text-center"
                  >
                    📝 Copy PGN Data
                  </button>
                </div>

                <div className="pt-3 border-t border-white/5 flex gap-2">
                  <button
                    onClick={() => {
                      sound.playHover();
                      setShowAddChapter(true);
                    }}
                    className={`flex-1 py-2 text-[10px] font-bold text-white rounded-xl cursor-pointer text-center ${bgAccent}`}
                  >
                    + Add New Chapter
                  </button>
                  <button
                    onClick={() => handleDeleteChapter(activeChapterIndex)}
                    className="py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-[10px] font-bold text-red-400 transition cursor-pointer px-3 text-center"
                  >
                    Delete Chapter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD CHAPTER MODAL OVERLAY */}
      {showAddChapter && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#12141a] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-gray-200">Add Chapter</h3>
              <button
                onClick={() => setShowAddChapter(false)}
                className="text-gray-400 hover:text-gray-200 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddChapter} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Chapter Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 2: English Attack"
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  className="bg-[#0f1216] border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-gray-200 font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Starting FEN (optional)</label>
                <input
                  type="text"
                  placeholder="Defaults to standard start position FEN"
                  value={newChapterFen}
                  onChange={(e) => setNewChapterFen(e.target.value)}
                  className="bg-[#0f1216] border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-gray-200 font-mono"
                />
              </div>

              <button
                type="submit"
                className={`w-full py-2.5 text-xs font-bold text-white rounded-xl cursor-pointer transition ${bgAccent}`}
              >
                Create Chapter
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
