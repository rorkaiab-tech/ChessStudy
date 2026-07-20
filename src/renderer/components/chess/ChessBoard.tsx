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
  // Direct DOM ref for the floating dragged piece (sub-16ms latency)
  const floatingRef = useRef<HTMLDivElement>(null);

  const [chess, setChess] = useState(new Chess(currentFen));
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  // Drag state: piece being dragged, and whether visual drag is active
  const [draggingPiece, setDraggingPiece] = useState<BoardPiece | null>(null);
  const dragStarted = useRef(false); // true once movement > threshold
  const dragSourceSquare = useRef<Square | null>(null);
  const [dragSourceSquareState, setDragSourceSquareState] = useState<Square | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragPointerId = useRef(0);

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

  useEffect(() => {
    legalSet.current = new Set(legalMoves);
  }, [legalMoves]);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSquare(null);
        setLegalMoves([]);
        setPromotionPending(null);
      }
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        flipBoard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

    setPieces((prevPieces) => {
      const matched: BoardPiece[] = [];
      const usedPrevIds = new Set<string>();

      newPieces.forEach((np) => {
        const prevMatch = prevPieces.find(
          (pp) => pp.square === np.square && pp.type === np.type && pp.color === np.color && !usedPrevIds.has(pp.id)
        );
        if (prevMatch) { np.id = prevMatch.id; matched.push(np); usedPrevIds.add(prevMatch.id); }
      });

      newPieces.forEach((np) => {
        if (np.id) return;
        if (lastMove && np.square === lastMove.to) {
          const prevMatch = prevPieces.find(
            (pp) => pp.square === lastMove.from && pp.type === np.type && pp.color === np.color && !usedPrevIds.has(pp.id)
          );
          if (prevMatch) { np.id = prevMatch.id; matched.push(np); usedPrevIds.add(prevMatch.id); return; }
        }
        const prevMatch = prevPieces.find(
          (pp) => pp.type === np.type && pp.color === np.color && !usedPrevIds.has(pp.id)
            && !newPieces.some(x => x.square === pp.square && x.type === pp.type && x.color === pp.color)
        );
        if (prevMatch) { np.id = prevMatch.id; matched.push(np); usedPrevIds.add(prevMatch.id); }
        else { np.id = Math.random().toString(36).substring(2, 9); matched.push(np); }
      });

      return matched;
    });
  }, [chess]);

  const getSquareCoordinates = useCallback((sq: Square) => {
    const fIdx = files.indexOf(sq[0]);
    const rIdx = ranks.indexOf(sq[1]);
    return {
      x: boardOrientation === 'white' ? fIdx : 7 - fIdx,
      y: boardOrientation === 'white' ? rIdx : 7 - rIdx,
    };
  }, [boardOrientation, files, ranks]);

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

  // Position the floating piece directly via DOM (zero-latency)
  const positionFloatingPiece = useCallback((clientX: number, clientY: number) => {
    if (!floatingRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    // Center the piece on the cursor
    const pieceSize = boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 : 60;
    const halfSize = pieceSize * 0.55; // 110% scale / 2
    floatingRef.current.style.left = `${clientX - containerRect.left - halfSize}px`;
    floatingRef.current.style.top = `${clientY - containerRect.top - halfSize}px`;
  }, []);

  const selectPiece = useCallback((sq: Square) => {
    setSelectedSquare(sq);
    const moves = chess.moves({ square: sq, verbose: true }) as any[];
    setLegalMoves(moves.map((m) => m.to as Square));
  }, [chess]);

  const executeMove = useCallback((from: Square, to: Square, promo = 'q') => {
    const interactiveMode = useChessStore.getState().interactiveMode;

    if (interactiveMode === 'practice') {
      checkPracticeMove(from, to, promo);
    } else if (interactiveMode === 'quiz') {
      submitQuizMove(from, to, promo);
    } else {
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

  // --- POINTER HANDLERS ---

  const handlePiecePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, piece: BoardPiece) => {
    if (e.button !== 0 || promotionPending) return;
    e.preventDefault();
    e.stopPropagation();

    skipNextClick.current = true;
    clearDrawing();

    // Legal capture on already-selected piece
    if (selectedSquare && selectedSquare !== piece.square && legalSet.current.has(piece.square)) {
      setMoveTransitionMs(150);
      handleMove(selectedSquare, piece.square);
      return;
    }

    // Select and prepare drag
    selectPiece(piece.square);
    setDraggingPiece(piece);
    dragSourceSquare.current = piece.square;
    setDragSourceSquareState(piece.square);
    dragStarted.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragPointerId.current = e.pointerId;

    if (boardRef.current) boardRef.current.setPointerCapture(e.pointerId);
  }, [promotionPending, selectedSquare, chess, clearDrawing, selectPiece, handleMove]);

  const handleBoardPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    if (draggingPiece) {
      // Start visual drag after 4px threshold
      if (!dragStarted.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragStarted.current = true;
      }
      if (dragStarted.current && floatingRef.current) {
        positionFloatingPiece(e.clientX, e.clientY);
      }
    } else if (rightClickStartSquare) {
      const hoverSq = getSquareFromPosition(e.clientX, e.clientY);
      if (hoverSq && hoverSq !== rightClickStartSquare) setArrowPreview({ from: rightClickStartSquare, to: hoverSq });
      else setArrowPreview(null);
    }
  }, [draggingPiece, rightClickStartSquare, getSquareFromPosition, positionFloatingPiece]);

  const handleBoardPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    if (draggingPiece) {
      if (boardRef.current) {
        try { boardRef.current.releasePointerCapture(e.pointerId); } catch {}
      }

      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const wasDragged = dragStarted.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10);
      const targetSq = getSquareFromPosition(e.clientX, e.clientY);

      if (wasDragged && targetSq && targetSq !== draggingPiece.square && legalSet.current.has(targetSq)) {
        // Legal drop: instant
        setMoveTransitionMs(0);
        setDraggingPiece(null);
        setDragSourceSquareState(null);
        dragStarted.current = false;
        dragSourceSquare.current = null;
        handleMove(draggingPiece.square, targetSq);
        return;
      }

      if (wasDragged) {
        // Illegal drop: snap back 120ms
        sound.playIllegal();
        setMoveTransitionMs(120);
        setSelectedSquare(null);
        setLegalMoves([]);
        setDraggingPiece(null);
        setDragSourceSquareState(null);
        dragStarted.current = false;
        dragSourceSquare.current = null;
        return;
      }

      // Not dragged = click on piece
      if (selectedSquare === draggingPiece.square) {
        setSelectedSquare(null);
        setLegalMoves([]);
      }

      setDraggingPiece(null);
      setDragSourceSquareState(null);
      dragStarted.current = false;
      dragSourceSquare.current = null;
    }
  }, [draggingPiece, selectedSquare, getSquareFromPosition, handleMove]);

  // --- CLICK HANDLER ---

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
    if (e.button === 2) {
      const sq = getSquareFromPosition(e.clientX, e.clientY);
      if (sq) setRightClickStartSquare(sq);
    }
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
      clearDrawing();
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [clearDrawing]);

  // --- HELPERS ---

  const effectiveDuration = moveTransitionMs / 1000;

  const checkedKingSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const boardState = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = boardState[r][c];
        if (p && p.type === 'k' && p.color === turn) return (files[c] + ranks[r]) as Square;
      }
    }
    return null;
  }, [chess, files, ranks]);

  const themeColors = useMemo(() => {
    const themes: Record<string, { light: string; dark: string }> = {
      lichess:  { light: '#eeeed2', dark: '#769656' },
      wood:     { light: '#F0D9B5', dark: '#B58863' },
      dark:     { light: '#C6C6C6', dark: '#7B7B7B' },
      midnight: { light: '#C8D6E5', dark: '#576574' },
      emerald:  { light: '#D4E6C3', dark: '#5A8A3C' },
    };
    return themes[boardTheme] || themes.wood;
  }, [boardTheme]);

  const getArrowCoords = useCallback((arrow: { from: string; to: string }) => {
    const fromCoords = getSquareCoordinates(arrow.from as Square);
    const toCoords = getSquareCoordinates(arrow.to as Square);
    const x1 = (fromCoords.x + 0.5) * 12.5;
    const y1 = (fromCoords.y + 0.5) * 12.5;
    const x2 = (toCoords.x + 0.5) * 12.5;
    const y2 = (toCoords.y + 0.5) * 12.5;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x1, y1, x2, y2 };
    const margin = 5;
    return { x1, y1, x2: x2 - (dx / len) * margin, y2: y2 - (dy / len) * margin };
  }, [getSquareCoordinates]);

  // Dragging piece image src
  const dragImgSrc = draggingPiece
    ? `./assets/pieces/${draggingPiece.color}${draggingPiece.type.toUpperCase()}.svg`
    : '';

  return (
    <div ref={containerRef} className="relative w-full max-w-[700px] select-none touch-none">
      {/* Floating dragged piece — rendered OUTSIDE board to avoid overflow:clip */}
      {draggingPiece && (
        <div
          ref={floatingRef}
          className="absolute pointer-events-none"
          style={{
            // Size: 110% of a square
            width: `${100 / 8 * 1.1}%`,
            height: `${100 / 8 * 1.1}%`,
            zIndex: 9999,
            filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))',
            opacity: dragStarted.current ? 1 : 0,
            transition: dragStarted.current ? 'none' : 'opacity 0.05s',
            willChange: 'left, top',
          }}
        >
          <img
            src={dragImgSrc}
            alt=""
            className="w-full h-full select-none pointer-events-none"
            draggable={false}
          />
        </div>
      )}

      {/* Coordinates - Top */}
      {showCoordinates && (
        <div className="flex w-full mb-0.5">
          {Array.from({ length: 8 }).map((_, colIdx) => {
            const fIdx = boardOrientation === 'white' ? colIdx : 7 - colIdx;
            return <div key={colIdx} className="flex-1 text-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{files[fIdx]}</span></div>;
          })}
        </div>
      )}

      <div className="flex">
        {showCoordinates && (
          <div className="flex flex-col w-5 mr-0.5" style={{ aspectRatio: '1/8' }}>
            {Array.from({ length: 8 }).map((_, rowIdx) => {
              const rIdx = boardOrientation === 'white' ? rowIdx : 7 - rowIdx;
              return <div key={rowIdx} className="flex-1 flex items-center justify-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{ranks[rIdx]}</span></div>;
            })}
          </div>
        )}

        {/* Board */}
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
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
            {Array.from({ length: 64 }).map((_, idx) => {
              const rowIdx = Math.floor(idx / 8);
              const colIdx = idx % 8;
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
                <div
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); handleSquareClick(sq); }}
                  className="relative w-full h-full"
                  style={{ backgroundColor: isLight ? themeColors.light : themeColors.dark }}
                >
                  {highlight && <div className="absolute inset-0 transition-colors duration-100" style={{ backgroundColor: highlight }} />}

                  {isLegal && (
                    <div className="absolute inset-0 pointer-events-none z-10">
                      {hasPiece ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div style={{
                            width: '85%', height: '85%', borderRadius: '50%',
                            border: `4px solid ${OLIVE} 0.7)`,
                            boxSizing: 'border-box',
                          }} />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full" style={{
                            width: '22%', height: '22%',
                            backgroundColor: `${OLIVE} 0.75)`,
                          }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pieces — original piece hidden when dragging */}
          <div className="absolute inset-0 pointer-events-none z-20">
            <AnimatePresence>
              {pieces.map((piece) => {
                const { x, y } = getSquareCoordinates(piece.square);
                const isThisDragging = draggingPiece?.id === piece.id && dragStarted.current;

                return (
                  <motion.div
                    key={piece.id}
                    layoutId={reducedMotion ? undefined : piece.id}
                    transition={{
                      duration: isThisDragging ? 0 : effectiveDuration,
                      ease: isThisDragging ? undefined : 'easeOut',
                    }}
                    className="absolute pointer-events-auto"
                    style={{
                      width: '12.5%', height: '12.5%',
                      top: `${y * 12.5}%`, left: `${x * 12.5}%`,
                      x: 0, y: 0,
                      zIndex: 30,
                      // Hide original when dragging
                      opacity: isThisDragging ? 0 : 1,
                      cursor: 'grab',
                    }}
                    whileHover={!draggingPiece ? { scale: 1.02, transition: { duration: 0.08 } } : undefined}
                    onPointerDown={(e) => handlePiecePointerDown(e, piece)}
                  >
                    <img
                      src={`./assets/pieces/${piece.color}${piece.type.toUpperCase()}.svg`}
                      alt={`${piece.color}${piece.type}`}
                      className="w-full h-full select-none pointer-events-none"
                      draggable={false}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* SVG Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-40 fill-none" viewBox="0 0 100 100">
            <defs>
              <marker id="arrowhead" markerWidth="5" markerHeight="5" refX="1.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0.5 L5,2.5 L0,4.5 Q1.5,2.5 0,0.5 Z" fill={`${OLIVE} 0.8)`} />
              </marker>
            </defs>

            {storeCircles.map((c, i) => {
              const coords = getSquareCoordinates(c.square as Square);
              const color = c.color === 'red' ? 'rgba(255,0,0,0.35)'
                : c.color === 'yellow' ? 'rgba(255,255,0,0.35)'
                : c.color === 'blue' ? 'rgba(0,100,255,0.35)'
                : 'rgba(98,113,53,0.35)';
              return <rect key={`sq-${i}`} x={coords.x * 12.5} y={coords.y * 12.5} width="12.5" height="12.5" fill={color} />;
            })}

            {storeArrows.map((a, i) => {
              const { x1, y1, x2, y2 } = getArrowCoords(a);
              return <line key={`a-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`${OLIVE} 0.8)`} strokeWidth="1.2" strokeLinecap="round" markerEnd="url(#arrowhead)" />;
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
            const menuTop = isTop ? `${coords.y * 12.5 - 50}%` : `${(coords.y + 1) * 12.5}%`;
            const menuLeft = `${coords.x * 12.5}%`;

            return (
              <div className="absolute inset-0 z-50" onClick={(e) => { e.stopPropagation(); setPromotionPending(null); }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute flex flex-col rounded-md overflow-hidden shadow-xl"
                  style={{
                    top: menuTop, left: menuLeft,
                    width: '12.5%', zIndex: 60,
                    background: '#1a1816',
                    border: '1px solid rgba(255,255,255,0.1)',
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
            {Array.from({ length: 8 }).map((_, rowIdx) => {
              const rIdx = boardOrientation === 'white' ? rowIdx : 7 - rowIdx;
              return <div key={rowIdx} className="flex-1 flex items-center justify-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{ranks[rIdx]}</span></div>;
            })}
          </div>
        )}
      </div>

      {showCoordinates && (
        <div className="flex w-full mt-0.5">
          {Array.from({ length: 8 }).map((_, colIdx) => {
            const fIdx = boardOrientation === 'white' ? colIdx : 7 - colIdx;
            return <div key={colIdx} className="flex-1 text-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{files[fIdx]}</span></div>;
          })}
        </div>
      )}
    </div>
  );
};
