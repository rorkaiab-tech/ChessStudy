import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Lesson, MoveNode, Chapter } from '../database/db';
import { sound } from '../services/soundService';
import { Chess } from 'chess.js';

// ==========================================
// 1. SETTINGS STORE (Persisted)
// ==========================================
export type BoardTheme = 'lichess' | 'wood' | 'dark' | 'midnight' | 'emerald';
export type AccentColor = 'emerald' | 'blue' | 'amber' | 'rose' | 'indigo';

interface SettingsState {
  boardTheme: BoardTheme;
  pieceTheme: string;
  boardSize: number; // in pixels (e.g., 600)
  animationSpeed: 'slow' | 'normal' | 'fast';
  showCoordinates: boolean;
  soundVolume: number; // 0 to 1
  autoFlip: boolean;
  accentColor: AccentColor;
  highContrast: boolean;
  reducedMotion: boolean;

  setBoardTheme: (theme: BoardTheme) => void;
  setBoardSize: (size: number) => void;
  setAnimationSpeed: (speed: 'slow' | 'normal' | 'fast') => void;
  setShowCoordinates: (show: boolean) => void;
  setSoundVolume: (vol: number) => void;
  setAutoFlip: (flip: boolean) => void;
  setAccentColor: (color: AccentColor) => void;
  setHighContrast: (val: boolean) => void;
  setReducedMotion: (val: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      boardTheme: 'wood',
      pieceTheme: 'cburnett',
      boardSize: 640,
      animationSpeed: 'normal',
      showCoordinates: true,
      soundVolume: 0.5,
      autoFlip: false,
      accentColor: 'blue',
      highContrast: false,
      reducedMotion: false,

      setBoardTheme: (boardTheme) => set({ boardTheme }),
      setBoardSize: (boardSize) => set({ boardSize }),
      setAnimationSpeed: (animationSpeed) => set({ animationSpeed }),
      setShowCoordinates: (showCoordinates) => set({ showCoordinates }),
      setSoundVolume: (soundVolume) => {
        set({ soundVolume });
        sound.setVolume(soundVolume);
      },
      setAutoFlip: (autoFlip) => set({ autoFlip }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: 'chess-study-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          sound.setVolume(state.soundVolume);
        }
      },
    }
  )
);

// ==========================================
// 2. CHESS SESSION STORE
// ==========================================
export type InteractiveMode = 'theory' | 'practice' | 'quiz' | 'edit';

interface ChessState {
  activeLesson: Lesson | null;
  activeChapterIndex: number;
  activeNode: MoveNode | null; // Pointer to current node in moveTree
  currentFen: string;
  boardOrientation: 'white' | 'black';
  lastMove: { from: string; to: string } | null;
  arrows: Array<{ from: string; to: string; color: string }>;
  circles: Array<{ square: string; color: string }>;
  interactiveMode: InteractiveMode;

  // Interactive Practice state
  practiceExpectedNodes: MoveNode[]; // Nodes black can play next
  practiceState: 'waiting' | 'correct' | 'wrong' | 'complete';
  practiceFeedback: string;

  // Quiz state
  quizIndex: number;
  quizCorrectCount: number;
  quizTotal: number;
  quizCompleted: boolean;
  quizQuestion: string;

  // Actions
  setActiveLesson: (lesson: Lesson | null, chapterIndex?: number) => void;
  setActiveChapterIndex: (index: number) => void;
  selectNode: (node: MoveNode | null) => void;
  setBoardOrientation: (orient: 'white' | 'black') => void;
  flipBoard: () => void;
  setInteractiveMode: (mode: InteractiveMode) => void;
  setFen: (fen: string) => void;
  setLastMove: (move: { from: string; to: string } | null) => void;

  // Arrow & Circles drawing
  addArrow: (arrow: { from: string; to: string; color: string }) => void;
  addCircle: (circle: { square: string; color: string }) => void;
  clearDrawing: () => void;
  setDrawing: (arrows: Array<{ from: string; to: string; color: string }>, circles: Array<{ square: string; color: string }>) => void;

  // Practice Engine actions
  initPracticeMode: () => void;
  checkPracticeMove: (from: string, to: string, promotion?: string) => boolean;

  // Quiz Engine actions
  initQuizMode: () => void;
  submitQuizMove: (from: string, to: string, promotion?: string) => boolean;
  nextQuizQuestion: () => void;
}

export const useChessStore = create<ChessState>((set, get) => ({
  activeLesson: null,
  activeChapterIndex: 0,
  activeNode: null,
  currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  boardOrientation: 'white',
  lastMove: null,
  arrows: [],
  circles: [],
  interactiveMode: 'theory',

  practiceExpectedNodes: [],
  practiceState: 'waiting',
  practiceFeedback: '',

  quizIndex: 0,
  quizCorrectCount: 0,
  quizTotal: 0,
  quizCompleted: false,
  quizQuestion: '',

  setActiveLesson: (lesson, chapterIndex = 0) => {
    if (!lesson) {
      set({
        activeLesson: null,
        activeChapterIndex: 0,
        activeNode: null,
        currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        lastMove: null,
        arrows: [],
        circles: [],
      });
      return;
    }

    const chapter = lesson.chapters[chapterIndex] || lesson.chapters[0];
    if (!chapter) return;

    set({
      activeLesson: lesson,
      activeChapterIndex: chapterIndex,
      activeNode: null,
      currentFen: chapter.fen,
      lastMove: null,
      arrows: [],
      circles: [],
    });

    const settings = useSettingsStore.getState();
    // Auto flip board based on FEN if active settings say so
    if (settings.autoFlip) {
      const activeColor = chapter.fen.split(' ')[1];
      set({ boardOrientation: activeColor === 'b' ? 'black' : 'white' });
    }

    // Reset sub-modes
    const { interactiveMode } = get();
    if (interactiveMode === 'practice') {
      get().initPracticeMode();
    } else if (interactiveMode === 'quiz') {
      get().initQuizMode();
    }
  },

  setActiveChapterIndex: (index) => {
    const { activeLesson } = get();
    if (!activeLesson) return;
    get().setActiveLesson(activeLesson, index);
  },

  selectNode: (node) => {
    if (!node) {
      const { activeLesson, activeChapterIndex } = get();
      const chapter = activeLesson?.chapters[activeChapterIndex];
      set({
        activeNode: null,
        currentFen: chapter ? chapter.fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        lastMove: null,
        arrows: [],
        circles: [],
      });
      return;
    }

    set({
      activeNode: node,
      currentFen: node.fen,
      lastMove: { from: node.from, to: node.to },
      arrows: node.arrows || [],
      circles: node.circles || [],
    });
  },

  setBoardOrientation: (boardOrientation) => set({ boardOrientation }),
  flipBoard: () => set((state) => ({ boardOrientation: state.boardOrientation === 'white' ? 'black' : 'white' })),

  setInteractiveMode: (interactiveMode) => {
    set({ interactiveMode });
    if (interactiveMode === 'practice') {
      get().initPracticeMode();
    } else if (interactiveMode === 'quiz') {
      get().initQuizMode();
    }
  },

  setFen: (currentFen) => set({ currentFen }),
  setLastMove: (lastMove) => set({ lastMove }),

  addArrow: (arrow) => set((s) => ({ arrows: [...s.arrows.filter(a => !(a.from === arrow.from && a.to === arrow.to)), arrow] })),
  addCircle: (circle) => set((s) => {
    const exists = s.circles.some(c => c.square === circle.square);
    return {
      circles: exists
        ? s.circles.filter(c => c.square !== circle.square)
        : [...s.circles, circle]
    };
  }),
  clearDrawing: () => set({ arrows: [], circles: [] }),
  setDrawing: (arrows, circles) => set({ arrows, circles }),

  // ------------------------------------------
  // Practice Engine
  // ------------------------------------------
  initPracticeMode: () => {
    const { activeLesson, activeChapterIndex } = get();
    if (!activeLesson) return;
    const chapter = activeLesson.chapters[activeChapterIndex];
    if (!chapter) return;

    // Reset board to chapter starting position
    set({
      activeNode: null,
      currentFen: chapter.fen,
      lastMove: null,
      practiceState: 'waiting',
      practiceFeedback: 'Find the first move for White!',
      practiceExpectedNodes: chapter.moves,
      arrows: [],
      circles: [],
    });

    const isWhiteToMove = chapter.fen.split(' ')[1] === 'w';
    set({ boardOrientation: isWhiteToMove ? 'white' : 'black' });
  },

  checkPracticeMove: (from, to, promotion = 'q') => {
    const { practiceExpectedNodes, currentFen } = get();
    if (practiceExpectedNodes.length === 0) return false;

    // Test move using chess.js
    const chess = new Chess(currentFen);
    try {
      const move = chess.move({ from, to, promotion });
      const nextFen = chess.fen();

      // Check if this move matches any of the expected children nodes
      const matchedNode = practiceExpectedNodes.find(
        (n) => n.from === from && n.to === to && (n.notation.includes('=') ? n.notation.includes(promotion.toUpperCase()) : true)
      );

      if (matchedNode) {
        sound.playMove();
        // Play correct feedback
        set({
          activeNode: matchedNode,
          currentFen: nextFen,
          lastMove: { from, to },
          practiceState: matchedNode.children.length === 0 ? 'complete' : 'correct',
          practiceFeedback: matchedNode.comment || 'Correct! Nice job.',
          arrows: matchedNode.arrows || [],
          circles: matchedNode.circles || [],
        });

        // If there is an opponent reply (the first child of the correct move), auto-play it!
        if (matchedNode.children.length > 0) {
          const replyNode = matchedNode.children[0];
          setTimeout(() => {
            const nextChess = new Chess(nextFen);
            nextChess.move({ from: replyNode.from, to: replyNode.to, promotion: 'q' });
            
            if (replyNode.notation.includes('x') || nextChess.history({ verbose: true }).pop()?.captured) {
              sound.playCapture();
            } else {
              sound.playMove();
            }

            // Check checking status after reply
            if (nextChess.inCheck()) {
              sound.playCheck();
            }

            set({
              activeNode: replyNode,
              currentFen: replyNode.fen,
              lastMove: { from: replyNode.from, to: replyNode.to },
              practiceExpectedNodes: replyNode.children,
              practiceFeedback: replyNode.comment || 'Now find the next move.',
              arrows: replyNode.arrows || [],
              circles: replyNode.circles || [],
            });

            if (replyNode.children.length === 0) {
              set({ practiceState: 'complete', practiceFeedback: 'Lesson Completed! Excellent study!' });
              sound.playSuccess();
            }
          }, 800);
        } else {
          set({ practiceState: 'complete', practiceFeedback: 'Lesson Completed! Excellent study!' });
          sound.playSuccess();
        }

        return true;
      } else {
        sound.playError();
        set({
          practiceState: 'wrong',
          practiceFeedback: 'Incorrect move. Try again or request a hint!',
        });
        return false;
      }
    } catch (e) {
      // Invalid move on board
      return false;
    }
  },

  // ------------------------------------------
  // Quiz Engine
  // ------------------------------------------
  initQuizMode: () => {
    const { activeLesson, activeChapterIndex } = get();
    if (!activeLesson) return;
    const chapter = activeLesson.chapters[activeChapterIndex];
    if (!chapter) return;

    // Gather all positions from the move tree that contain comments or have annotations to quiz the user.
    // As a simple quiz: we will collect nodes where we ask the user to guess the moves.
    // For our seed lessons, let's flat collect all nodes in the tree.
    const allQuizNodes: MoveNode[] = [];
    const traverse = (node: MoveNode) => {
      // If a node is played by our color, it's a candidate quiz position (i.e. parent position FEN, guess the node)
      allQuizNodes.push(node);
      node.children.forEach(traverse);
    };
    chapter.moves.forEach(traverse);

    if (allQuizNodes.length === 0) {
      set({ quizTotal: 0, quizCompleted: true });
      return;
    }

    // Set first quiz question
    const firstNode = allQuizNodes[0];
    const parentFen = chapter.fen; // Start of chapter

    set({
      quizIndex: 0,
      quizCorrectCount: 0,
      quizTotal: Math.min(5, allQuizNodes.length),
      quizCompleted: false,
      activeNode: null,
      currentFen: parentFen,
      lastMove: null,
      quizQuestion: `Find the correct move: ${firstNode.notation} was played in this position. Can you find it?`,
      arrows: [],
      circles: [],
    });
  },

  submitQuizMove: (from, to, promotion = 'q') => {
    const { activeLesson, activeChapterIndex, quizIndex } = get();
    if (!activeLesson) return false;
    const chapter = activeLesson.chapters[activeChapterIndex];
    if (!chapter) return false;

    // Compile nodes in order
    const allQuizNodes: MoveNode[] = [];
    const traverse = (node: MoveNode) => {
      allQuizNodes.push(node);
      node.children.forEach(traverse);
    };
    chapter.moves.forEach(traverse);

    const currentNode = allQuizNodes[quizIndex];
    if (!currentNode) return false;

    if (currentNode.from === from && currentNode.to === to) {
      sound.playSuccess();
      set((s) => ({
        quizCorrectCount: s.quizCorrectCount + 1,
        currentFen: currentNode.fen,
        lastMove: { from, to },
        arrows: currentNode.arrows || [],
        circles: currentNode.circles || [],
      }));
      return true;
    } else {
      sound.playError();
      return false;
    }
  },

  nextQuizQuestion: () => {
    const { activeLesson, activeChapterIndex, quizIndex, quizTotal } = get();
    if (!activeLesson) return;
    const chapter = activeLesson.chapters[activeChapterIndex];
    if (!chapter) return;

    const allQuizNodes: MoveNode[] = [];
    const traverse = (node: MoveNode) => {
      allQuizNodes.push(node);
      node.children.forEach(traverse);
    };
    chapter.moves.forEach(traverse);

    const nextIdx = quizIndex + 1;
    if (nextIdx >= quizTotal || nextIdx >= allQuizNodes.length) {
      set({ quizCompleted: true });
      return;
    }

    const nextNode = allQuizNodes[nextIdx];
    // Find parent FEN of nextNode: it's either the chapter FEN or the FEN of the parent node
    // To make it simple, we find the node in tree whose children contains nextNode.
    let parentFen = chapter.fen;
    const findParent = (current: MoveNode): boolean => {
      if (current.children.some(c => c.id === nextNode.id)) {
        parentFen = current.fen;
        return true;
      }
      return current.children.some(findParent);
    };
    
    chapter.moves.some(findParent);

    set({
      quizIndex: nextIdx,
      currentFen: parentFen,
      lastMove: null,
      arrows: [],
      circles: [],
      quizQuestion: `Find the move: the notation is ${nextNode.notation}. Find it!`,
    });
  }
}));
