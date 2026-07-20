import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chess, Square } from 'chess.js';
import { useChessStore, useSettingsStore } from '../../stores/chessStore';
import { sound } from '../../services/soundService';

interface BoardPiece {
  id: string;
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  square: Square;
}

const OLIVE = 'rgba(98, 113, 53,';

// Z-index layers per spec
const Z = {
  SQUARE: 1,
  HIGHLIGHT: 100,
  PIECE: 200,
  ARROW: 300,
  CONTEXT: 800,
  PROMO: 900,
  DRAG: 1000,
} as const;

// Easing: cubic-bezier(0.22, 1, 0.36, 1) — accelerated start, gentle deceleration
const MOVE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const ChessBoard: React.FC = () => {
  const currentFen = useChessStore((s) => s.currentFen);
  const lastMove = useChessStore((s) => s.lastMove);
  const boardOrientation = useChessStore((s) => s.boardOrientation);
  const flipBoard = useChessStore((s) => s.flipBoard);
  const storeArrows = useChessStore((s) => s.arrows);
  const storeCircles = useChessStore((s) => s.circles);
  const addArrow = useChessStore((s) => s.addArrow);
  const addCircle = useChessStore((s) => s.addCircle);
  const clearDrawing = useChessStore((s) => s.clearDrawing);
  const checkPracticeMove = useChessStore((s) => s.checkPracticeMove);
  const submitQuizMove = useChessStore((s) => s.submitQuizMove);
  const { boardTheme, showCoordinates, animationSpeed, reducedMotion } = useSettingsStore();

  const boardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const snapHighlightRef = useRef<HTMLDivElement>(null);

  const [chess, setChess] = useState(new Chess(currentFen));
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [draggingPiece, setDraggingPiece] = useState<BoardPiece | null>(null);
  const dragActive = useRef(false); // true once >4px threshold
  const dragStartPos = useRef({ x: 0, y: 0 });
  const lastSnapSquare = useRef<Square | null>(null);
  const [dragSourceSquare, setDragSourceSquare] = useState<Square | null>(null);
  const [activeDropSquare, setActiveDropSquare] = useState<Square | null>(null);

  const [rightClickStartSquare, setRightClickStartSquare] = useState<Square | null>(null);
  const [arrowPreview, setArrowPreview] = useState<{ from: Square; to: Square } | null>(null);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);
  const [moveTransitionMs, setMoveTransitionMs] = useState(150);
  const skipNextClick = useRef(false);
  const legalSet = useRef(new Set<Square>());

  const files = useMemo(() => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], []);
  const ranks = useMemo(() => ['8', '7', '6', '5', '4', '3', '2', '1'], []);

  useEffect(() => {
    setChess(new Chess(currentFen));
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [currentFen]);

  useEffect(() => { legalSet.current = new Set(legalMoves); }, [legalMoves]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedSquare(null); setLegalMoves([]); setPromotionPending(null); }
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); flipBoard(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipBoard]);

  // Sync pieces
  useEffect(() => {
    const boardState = chess.board();
    const newPieces: BoardPiece[] = [];
    boardState.forEach((row, rIdx) => {
      row.forEach((col, cIdx) => {
        if (col) {
          const sq = (files[cIdx] + ranks[rIdx]) as Square;
          newPieces.push({ id: '', type: col.type, color: col.color, square: sq });
        }
      });
    });

    setPieces((prev) => {
      const matched: BoardPiece[] = [];
      const used = new Set<string>();

      newPieces.forEach((np) => {
        const m = prev.find((pp) => pp.square === np.square && pp.type === np.type && pp.color === np.color && !used.has(pp.id));
        if (m) { np.id = m.id; matched.push(np); used.add(m.id); }
      });
      newPieces.forEach((np) => {
        if (np.id) return;
        if (lastMove && np.square === lastMove.to) {
          const m = prev.find((pp) => pp.square === lastMove.from && pp.type === np.type && pp.color === np.color && !used.has(pp.id));
          if (m) { np.id = m.id; matched.push(np); used.add(m.id); return; }
        }
        const m = prev.find((pp) => pp.type === np.type && pp.color === np.color && !used.has(pp.id) && !newPieces.some(x => x.square === pp.square && x.type === pp.type && x.color === pp.color));
        if (m) { np.id = m.id; matched.push(np); used.add(m.id); }
        else { np.id = Math.random().toString(36).substring(2, 9); matched.push(np); }
      });
      return matched;
    });
  }, [chess]);

  const getSquareCoordinates = useCallback((sq: Square) => {
    const fIdx = files.indexOf(sq[0]);
    const rIdx = ranks.indexOf(sq[1]);
    return { x: boardOrientation === 'white' ? fIdx : 7 - fIdx, y: boardOrientation === 'white' ? rIdx : 7 - rIdx };
  }, [boardOrientation, files, ranks]);

  // Standard grid detection (any point in square)
  const getSquareFromPosition = useCallback((clientX: number, clientY: number): Square | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;
    const col = Math.floor((x / rect.width) * 8);
    const row = Math.floor((y / rect.height) * 8);
    const fIdx = boardOrientation === 'white' ? col : 7 - col;
    const rIdx = boardOrientation === 'white' ? row : 7 - row;
    if (fIdx >= 0 && fIdx < 8 && rIdx >= 0 && rIdx < 8) return (files[fIdx] + ranks[rIdx]) as Square;
    return null;
  }, [boardOrientation, files, ranks]);

  // Snap detection: only returns square if cursor is in central 65% of it
  const getSnapSquare = useCallback((clientX: number, clientY: number): Square | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;

    const sqSize = rect.width / 8;
    const col = Math.floor(x / sqSize);
    const row = Math.floor(y / sqSize);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;

    // Fractional position within the square (0..1)
    const fracX = (x - col * sqSize) / sqSize;
    const fracY = (y - row * sqSize) / sqSize;

    // Central 65% zone: margin = (1 - 0.65) / 2 = 0.175
    const margin = 0.175;
    if (fracX < margin || fracX > 1 - margin || fracY < margin || fracY > 1 - margin) {
      // Cursor is near the edge — keep previous snap target (hysteresis)
      return lastSnapSquare.current;
    }

    const fIdx = boardOrientation === 'white' ? col : 7 - col;
    const rIdx = boardOrientation === 'white' ? row : 7 - row;
    if (fIdx >= 0 && fIdx < 8 && rIdx >= 0 && rIdx < 8) {
      const sq = (files[fIdx] + ranks[rIdx]) as Square;
      lastSnapSquare.current = sq;
      return sq;
    }
    return lastSnapSquare.current;
  }, [boardOrientation, files, ranks]);

  // Position floating piece via direct DOM (sub-16ms)
  const positionFloating = useCallback((clientX: number, clientY: number) => {
    if (!floatingRef.current || !containerRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const sqSize = boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 : 60;
    const half = sqSize * 0.54; // 108% / 2
    floatingRef.current.style.left = `${clientX - cRect.left - half}px`;
    floatingRef.current.style.top = `${clientY - cRect.top - half}px`;
  }, []);

  // Update snap highlight via direct DOM (sub-16ms, no re-render)
  const updateSnapHighlight = useCallback((sq: Square | null) => {
    if (!snapHighlightRef.current || !boardRef.current) return;
    const el = snapHighlightRef.current;
    if (!sq) {
      el.style.opacity = '0';
      return;
    }
    const coords = getSquareCoordinates(sq);
    const pct = 12.5;
    el.style.left = `${coords.x * pct}%`;
    el.style.top = `${coords.y * pct}%`;
    el.style.width = `${pct}%`;
    el.style.height = `${pct}%`;
    el.style.opacity = '1';
  }, [getSquareCoordinates]);

  const selectPiece = useCallback((sq: Square) => {
    setSelectedSquare(sq);
    const moves = chess.moves({ square: sq, verbose: true }) as any[];
    setLegalMoves(moves.map((m) => m.to as Square));
  }, [chess]);

  const executeMove = useCallback((from: Square, to: Square, promo = 'q') => {
    const interactiveMode = useChessStore.getState().interactiveMode;
    if (interactiveMode === 'practice') { checkPracticeMove(from, to, promo); }
    else if (interactiveMode === 'quiz') { submitQuizMove(from, to, promo); }
    else {
      try {
        const nextChess = new Chess(chess.fen());
        const move = nextChess.move({ from, to, promotion: promo });
        if (move.captured || move.san.includes('x')) sound.playCapture();
        else if (move.san === 'O-O' || move.san === 'O-O-O') sound.playCastle();
        else sound.playMove();
        if (nextChess.inCheck()) sound.playCheck();
        if (nextChess.isCheckmate()) sound.playCheckmate();
        else if (nextChess.isGameOver()) sound.playSuccess();
        useChessStore.getState().setFen(nextChess.fen());
        useChessStore.getState().setLastMove({ from, to });
      } catch { /* invalid */ }
    }
    useChessStore.getState().clearDrawing();
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionPending(null);
  }, [chess, checkPracticeMove, submitQuizMove]);

  const handleMove = useCallback((from: Square, to: Square, promotionPiece = 'q') => {
    const piece = chess.get(from);
    if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      setPromotionPending({ from, to });
      return;
    }
    executeMove(from, to, promotionPiece);
  }, [chess, executeMove]);

  // --- POINTER ---

  const handlePiecePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, piece: BoardPiece) => {
    if (e.button !== 0 || promotionPending) return;
    e.preventDefault();
    e.stopPropagation();

    skipNextClick.current = true;
    clearDrawing();

    // Legal capture on selected piece
    if (selectedSquare && selectedSquare !== piece.square && legalSet.current.has(piece.square)) {
      setMoveTransitionMs(150);
      handleMove(selectedSquare, piece.square);
      return;
    }

    // Select and prepare potential drag
    selectPiece(piece.square);
    setDraggingPiece(piece);
    setDragSourceSquare(piece.square);
    dragActive.current = false;
    lastSnapSquare.current = null;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setActiveDropSquare(null);

    if (boardRef.current) boardRef.current.setPointerCapture(e.pointerId);
  }, [promotionPending, selectedSquare, chess, clearDrawing, selectPiece, handleMove]);

  const handleBoardPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingPiece) {
      if (rightClickStartSquare) {
        const hoverSq = getSquareFromPosition(e.clientX, e.clientY);
        if (hoverSq && hoverSq !== rightClickStartSquare) setArrowPreview({ from: rightClickStartSquare, to: hoverSq });
        else setArrowPreview(null);
      }
      return;
    }

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    // 4px threshold to start drag
    if (!dragActive.current) {
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragActive.current = true;
        // Position floating piece at cursor immediately
        positionFloating(e.clientX, e.clientY);
      }
      return;
    }

    // Drag is active — update floating piece position (direct DOM, no re-render)
    positionFloating(e.clientX, e.clientY);

    // Update snap target (direct DOM, no re-render)
    const snapSq = getSnapSquare(e.clientX, e.clientY);
    if (snapSq !== lastSnapSquare.current) {
      lastSnapSquare.current = snapSq;
      updateSnapHighlight(snapSq);
      setActiveDropSquare(snapSq); // state only for legal move indicator rendering
    }
  }, [draggingPiece, rightClickStartSquare, getSquareFromPosition, positionFloating, getSnapSquare, updateSnapHighlight]);

  const handleBoardPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    if (draggingPiece) {
      if (boardRef.current) {
        try { boardRef.current.releasePointerCapture(e.pointerId); } catch {}
      }

      if (dragActive.current) {
        const targetSq = getSnapSquare(e.clientX, e.clientY);

        if (targetSq && targetSq !== draggingPiece.square && legalSet.current.has(targetSq)) {
          // Legal drop
          setMoveTransitionMs(150);
          setDraggingPiece(null);
          setDragSourceSquare(null);
          setActiveDropSquare(null);
          dragActive.current = false;
          lastSnapSquare.current = null;
          updateSnapHighlight(null);
          handleMove(draggingPiece.square, targetSq);
          return;
        }

        // Illegal drop: 110ms snapback
        sound.playIllegal();
        setMoveTransitionMs(110);
        setSelectedSquare(null);
        setLegalMoves([]);
        setDraggingPiece(null);
        setDragSourceSquare(null);
        setActiveDropSquare(null);
        dragActive.current = false;
        lastSnapSquare.current = null;
        updateSnapHighlight(null);
        return;
      }

      // Not dragged = click on piece
      if (selectedSquare === draggingPiece.square) {
        setSelectedSquare(null);
        setLegalMoves([]);
      }

      setDraggingPiece(null);
      setDragSourceSquare(null);
      setActiveDropSquare(null);
      dragActive.current = false;
      updateSnapHighlight(null);
    }
  }, [draggingPiece, selectedSquare, getSnapSquare, handleMove, updateSnapHighlight]);

  // --- CLICK ---

  const handleSquareClick = useCallback((sq: Square) => {
    if (promotionPending) return;
    if (skipNextClick.current) { skipNextClick.current = false; return; }
    clearDrawing();
    if (selectedSquare && legalSet.current.has(sq) && selectedSquare !== sq) {
      setMoveTransitionMs(150);
      handleMove(selectedSquare, sq);
      return;
    }
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [promotionPending, selectedSquare, handleMove, clearDrawing]);

  // --- RIGHT-CLICK ---

  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); }, []);

  const handleBoardMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { const sq = getSquareFromPosition(e.clientX, e.clientY); if (sq) setRightClickStartSquare(sq); }
  }, [getSquareFromPosition]);

  const handleBoardMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2 && rightClickStartSquare) {
      const targetSq = getSquareFromPosition(e.clientX, e.clientY);
      if (targetSq) {
        if (rightClickStartSquare === targetSq) addCircle({ square: targetSq, color: 'green' });
        else addArrow({ from: rightClickStartSquare, to: targetSq, color: 'green' });
      }
      setRightClickStartSquare(null);
      setArrowPreview(null);
    }
  }, [rightClickStartSquare, getSquareFromPosition, addCircle, addArrow]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      if (skipNextClick.current) { skipNextClick.current = false; return; }
      clearDrawing(); setSelectedSquare(null); setLegalMoves([]);
    }
  }, [clearDrawing]);

  // --- HELPERS ---

  const effectiveDuration = moveTransitionMs / 1000;

  const checkedKingSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const boardState = chess.board();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = boardState[r][c];
      if (p && p.type === 'k' && p.color === turn) return (files[c] + ranks[r]) as Square;
    }
    return null;
  }, [chess, files, ranks]);

  const themeColors = useMemo(() => {
    const themes: Record<string, { light: string; dark: string }> = {
      lichess: { light: '#eeeed2', dark: '#769656' },
      wood: { light: '#F0D9B5', dark: '#B58863' },
      dark: { light: '#C6C6C6', dark: '#7B7B7B' },
      midnight: { light: '#C8D6E5', dark: '#576574' },
      emerald: { light: '#D4E6C3', dark: '#5A8A3C' },
    };
    return themes[boardTheme] || themes.wood;
  }, [boardTheme]);

  const getArrowCoords = useCallback((arrow: { from: string; to: string }) => {
    const fc = getSquareCoordinates(arrow.from as Square);
    const tc = getSquareCoordinates(arrow.to as Square);
    const x1 = (fc.x + 0.5) * 12.5, y1 = (fc.y + 0.5) * 12.5;
    const x2 = (tc.x + 0.5) * 12.5, y2 = (tc.y + 0.5) * 12.5;
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x1, y1, x2, y2 };
    const m = 5;
    return { x1, y1, x2: x2 - (dx / len) * m, y2: y2 - (dy / len) * m };
  }, [getSquareCoordinates]);

  const dragImgSrc = draggingPiece ? `./assets/pieces/${draggingPiece.color}${draggingPiece.type.toUpperCase()}.svg` : '';

  return (
    <div ref={containerRef} className="relative w-full max-w-[700px] select-none touch-none">

      {/* Floating dragged piece — OUTSIDE board, not clipped */}
      {draggingPiece && (
        <div
          ref={floatingRef}
          className="absolute pointer-events-none"
          style={{
            width: `${100 / 8 * 1.08}%`,
            height: `${100 / 8 * 1.08}%`,
            zIndex: Z.DRAG,
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.30))',
            opacity: dragActive.current ? 1 : 0,
            willChange: 'left, top',
            cursor: 'grabbing',
          }}
        >
          <img src={dragImgSrc} alt="" className="w-full h-full select-none pointer-events-none" draggable={false} />
        </div>
      )}

      {/* Coordinates - Top */}
      {showCoordinates && (
        <div className="flex w-full mb-0.5">
          {Array.from({ length: 8 }).map((_, i) => {
            const fIdx = boardOrientation === 'white' ? i : 7 - i;
            return <div key={i} className="flex-1 text-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{files[fIdx]}</span></div>;
          })}
        </div>
      )}

      <div className="flex">
        {showCoordinates && (
          <div className="flex flex-col w-5 mr-0.5" style={{ aspectRatio: '1/8' }}>
            {Array.from({ length: 8 }).map((_, i) => {
              const rIdx = boardOrientation === 'white' ? i : 7 - i;
              return <div key={i} className="flex-1 flex items-center justify-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{ranks[rIdx]}</span></div>;
            })}
          </div>
        )}

        <div
          ref={boardRef}
          className="relative w-full aspect-square overflow-hidden cursor-pointer"
          onContextMenu={handleContextMenu}
          onMouseDown={handleBoardMouseDown}
          onMouseUp={handleBoardMouseUp}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onClick={handleBackgroundClick}
        >
          {/* Squares */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8" style={{ zIndex: Z.SQUARE }}>
            {Array.from({ length: 64 }).map((_, idx) => {
              const rowIdx = Math.floor(idx / 8), colIdx = idx % 8;
              const fIdx = boardOrientation === 'white' ? colIdx : 7 - colIdx;
              const rIdx = boardOrientation === 'white' ? rowIdx : 7 - rowIdx;
              const sq = (files[fIdx] + ranks[rIdx]) as Square;
              const isLight = (colIdx + rowIdx) % 2 === 0;
              const isLastMoveSrc = lastMove && lastMove.from === sq;
              const isLastMoveDst = lastMove && lastMove.to === sq;
              const isSelected = selectedSquare === sq;
              const isCheck = checkedKingSquare === sq;
              const isLegal = legalSet.current.has(sq);
              const hasPiece = !!chess.get(sq);

              let highlight = '';
              if (isCheck) highlight = 'rgba(255,0,0,0.4)';
              else if (isLastMoveSrc || isLastMoveDst) highlight = 'rgba(255,255,50,0.3)';
              else if (isSelected) highlight = `${OLIVE} 0.4)`;

              return (
                <div key={idx} onClick={(e) => { e.stopPropagation(); handleSquareClick(sq); }}
                  className="relative w-full h-full" style={{ backgroundColor: isLight ? themeColors.light : themeColors.dark }}>
                  {highlight && <div className="absolute inset-0" style={{ backgroundColor: highlight, zIndex: Z.HIGHLIGHT, transition: 'background-color 70ms' }} />}
                  {isLegal && (
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: Z.HIGHLIGHT + 10, transition: 'opacity 100ms' }}>
                      {hasPiece ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div style={{ width: '85%', height: '85%', borderRadius: '50%', border: `4px solid ${OLIVE} 0.7)`, boxSizing: 'border-box' }} />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full" style={{ width: '22%', height: '22%', backgroundColor: `${OLIVE} 0.75)` }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Snap highlight (direct DOM updates, no re-render) */}
          <div ref={snapHighlightRef} className="absolute pointer-events-none"
            style={{ zIndex: Z.HIGHLIGHT + 5, opacity: 0, transition: 'left 50ms, top 50ms, opacity 50ms',
              backgroundColor: 'rgba(255,255,255,0.13)' }} />

          {/* Pieces */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: Z.PIECE }}>
            <AnimatePresence>
              {pieces.map((piece) => {
                const { x, y } = getSquareCoordinates(piece.square);
                const isHidden = draggingPiece?.id === piece.id && dragActive.current;

                return (
                  <motion.div
                    key={piece.id}
                    layoutId={reducedMotion ? undefined : piece.id}
                    transition={{
                      duration: isHidden ? 0 : effectiveDuration,
                      ease: isHidden ? undefined : MOVE_EASE,
                    }}
                    className="absolute pointer-events-auto"
                    style={{
                      width: '12.5%', height: '12.5%',
                      top: `${y * 12.5}%`, left: `${x * 12.5}%`,
                      x: 0, y: 0,
                      zIndex: Z.PIECE,
                      opacity: isHidden ? 0 : 1,
                      cursor: 'grab',
                    }}
                    whileHover={!draggingPiece ? { scale: 1.02, transition: { duration: 0.08 } } : undefined}
                    onPointerDown={(e) => handlePiecePointerDown(e, piece)}
                  >
                    <img src={`./assets/pieces/${piece.color}${piece.type.toUpperCase()}.svg`}
                      alt={`${piece.color}${piece.type}`}
                      className="w-full h-full select-none pointer-events-none" draggable={false} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* SVG: Arrows & Highlights */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none fill-none" style={{ zIndex: Z.ARROW }} viewBox="0 0 100 100">
            <defs>
              <marker id="arrowhead" markerWidth="5" markerHeight="5" refX="1.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0.5 L5,2.5 L0,4.5 Q1.5,2.5 0,0.5 Z" fill={`${OLIVE} 0.8)`} />
              </marker>
            </defs>
            {storeCircles.map((c, i) => {
              const coords = getSquareCoordinates(c.square as Square);
              const color = c.color === 'red' ? 'rgba(255,0,0,0.35)' : c.color === 'yellow' ? 'rgba(255,255,0,0.35)' : c.color === 'blue' ? 'rgba(0,100,255,0.35)' : 'rgba(98,113,53,0.35)';
              return <rect key={`sq-${i}`} x={coords.x * 12.5} y={coords.y * 12.5} width="12.5" height="12.5" fill={color} />;
            })}
            {storeArrows.map((a, i) => {
              const { x1, y1, x2, y2 } = getArrowCoords(a);
              return <line key={`a-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`${OLIVE} 0.8)`} strokeWidth="1.2" strokeLinecap="round" markerEnd="url(#arrowhead)" style={{ transition: 'opacity 120ms' }} />;
            })}
            {arrowPreview && (() => {
              const { x1, y1, x2, y2 } = getArrowCoords(arrowPreview);
              return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={`${OLIVE} 0.6)`} strokeWidth="1" strokeLinecap="round" markerEnd="url(#arrowhead)" />;
            })()}
          </svg>

          {/* Promotion */}
          {promotionPending && (() => {
            const color = chess.turn();
            const options: ('q' | 'r' | 'b' | 'n')[] = ['q', 'r', 'b', 'n'];
            const coords = getSquareCoordinates(promotionPending.to);
            const isTop = promotionPending.to[1] === '8';
            return (
              <div className="absolute inset-0" style={{ zIndex: Z.PROMO }} onClick={(e) => { e.stopPropagation(); setPromotionPending(null); }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.08, ease: 'easeOut' }}
                  className="absolute flex flex-col rounded-md overflow-hidden shadow-xl"
                  style={{
                    top: isTop ? `${coords.y * 12.5 - 50}%` : `${(coords.y + 1) * 12.5}%`,
                    left: `${coords.x * 12.5}%`, width: '12.5%',
                    background: '#1a1816', border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {options.map((opt) => (
                    <button key={opt}
                      onClick={() => { sound.playPromotion(); executeMove(promotionPending.from, promotionPending.to, opt); }}
                      className="hover:bg-white/15 transition-colors cursor-pointer p-1 flex items-center justify-center"
                      style={{ aspectRatio: '1' }}>
                      <img src={`./assets/pieces/${color}${opt.toUpperCase()}.svg`} alt={opt} className="w-full h-full" />
                    </button>
                  ))}
                </motion.div>
              </div>
            );
          })()}
        </div>

        {showCoordinates && (
          <div className="flex flex-col w-5 ml-0.5" style={{ aspectRatio: '1/8' }}>
            {Array.from({ length: 8 }).map((_, i) => {
              const rIdx = boardOrientation === 'white' ? i : 7 - i;
              return <div key={i} className="flex-1 flex items-center justify-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{ranks[rIdx]}</span></div>;
            })}
          </div>
        )}
      </div>

      {showCoordinates && (
        <div className="flex w-full mt-0.5">
          {Array.from({ length: 8 }).map((_, i) => {
            const fIdx = boardOrientation === 'white' ? i : 7 - i;
            return <div key={i} className="flex-1 text-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{files[fIdx]}</span></div>;
          })}
        </div>
      )}
    </div>
  );
};
