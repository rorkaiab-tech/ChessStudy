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

export const ChessBoard: React.FC = () => {
  const currentFen = useChessStore((s) => s.currentFen);
  const lastMove = useChessStore((s) => s.lastMove);
  const boardOrientation = useChessStore((s) => s.boardOrientation);
  const arrows = useChessStore((s) => s.arrows);
  const circles = useChessStore((s) => s.circles);
  const addArrow = useChessStore((s) => s.addArrow);
  const addCircle = useChessStore((s) => s.addCircle);
  const clearDrawing = useChessStore((s) => s.clearDrawing);
  const checkPracticeMove = useChessStore((s) => s.checkPracticeMove);
  const submitQuizMove = useChessStore((s) => s.submitQuizMove);
  const { boardTheme, showCoordinates, animationSpeed, reducedMotion } = useSettingsStore();

  const boardRef = useRef<HTMLDivElement>(null);

  const [chess, setChess] = useState(new Chess(currentFen));
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [draggingPiece, setDraggingPiece] = useState<BoardPiece | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [rightClickStartSquare, setRightClickStartSquare] = useState<Square | null>(null);
  const [arrowPreview, setArrowPreview] = useState<{ from: Square; to: Square } | null>(null);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

  const files = useMemo(() => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], []);
  const ranks = useMemo(() => ['8', '7', '6', '5', '4', '3', '2', '1'], []);

  // Sync chess.js engine with store FEN
  useEffect(() => {
    setChess(new Chess(currentFen));
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [currentFen]);

  // Sync piece representation
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
        if (prevMatch) {
          np.id = prevMatch.id;
          matched.push(np);
          usedPrevIds.add(prevMatch.id);
        }
      });

      newPieces.forEach((np) => {
        if (np.id) return;
        if (lastMove && np.square === lastMove.to) {
          const prevMatch = prevPieces.find(
            (pp) => pp.square === lastMove.from && pp.type === np.type && pp.color === np.color && !usedPrevIds.has(pp.id)
          );
          if (prevMatch) {
            np.id = prevMatch.id;
            matched.push(np);
            usedPrevIds.add(prevMatch.id);
            return;
          }
        }
        const prevMatch = prevPieces.find(
          (pp) => pp.type === np.type && pp.color === np.color && !usedPrevIds.has(pp.id) && !newPieces.some(x => x.square === pp.square && x.type === pp.type && x.color === pp.color)
        );
        if (prevMatch) {
          np.id = prevMatch.id;
          matched.push(np);
          usedPrevIds.add(prevMatch.id);
        } else {
          np.id = Math.random().toString(36).substring(2, 9);
          matched.push(np);
        }
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

    if (fIdx >= 0 && fIdx < 8 && rIdx >= 0 && rIdx < 8) {
      return (files[fIdx] + ranks[rIdx]) as Square;
    }
    return null;
  }, [boardOrientation, files, ranks]);

  const handleMove = useCallback((from: Square, to: Square, promotionPiece = 'q') => {
    const piece = chess.get(from);
    if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      setPromotionPending({ from, to });
      return;
    }
    executeMove(from, to, promotionPiece);
  }, [chess]);

  const executeMove = useCallback((from: Square, to: Square, promo = 'q') => {
    const interactiveMode = useChessStore.getState().interactiveMode;
    let success = false;

    if (interactiveMode === 'practice') {
      success = checkPracticeMove(from, to, promo);
    } else if (interactiveMode === 'quiz') {
      success = submitQuizMove(from, to, promo);
    } else {
      try {
        const nextChess = new Chess(chess.fen());
        const move = nextChess.move({ from, to, promotion: promo });
        if (move.captured || move.san.includes('x')) {
          sound.playCapture();
        } else if (move.san === 'O-O' || move.san === 'O-O-O') {
          sound.playCastle();
        } else {
          sound.playMove();
        }
        if (nextChess.inCheck()) sound.playCheck();
        if (nextChess.isCheckmate()) { sound.playCheckmate(); }
        else if (nextChess.isGameOver()) { sound.playSuccess(); }

        success = true;
        useChessStore.getState().setFen(nextChess.fen());
        useChessStore.getState().setLastMove({ from, to });
      } catch {
        success = false;
      }
    }

    useChessStore.getState().clearDrawing();
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionPending(null);
  }, [chess, checkPracticeMove, submitQuizMove]);

  const handleSquareClick = useCallback((sq: Square) => {
    if (promotionPending) return;
    if (selectedSquare === sq) {
      clearDrawing();
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }
    if (legalMoves.includes(sq) && selectedSquare) {
      handleMove(selectedSquare, sq);
      return;
    }
    const piece = chess.get(sq);
    if (piece) {
      setSelectedSquare(sq);
      const moves = chess.moves({ square: sq, verbose: true }) as any[];
      setLegalMoves(moves.map((m) => m.to as Square));
    } else {
      clearDrawing();
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [promotionPending, selectedSquare, legalMoves, chess, clearDrawing, handleMove]);

  // Pointer drag
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, piece: BoardPiece) => {
    if (e.button !== 0 || promotionPending) return;
    e.preventDefault();
    setSelectedSquare(piece.square);
    const moves = chess.moves({ square: piece.square, verbose: true }) as any[];
    setLegalMoves(moves.map((m) => m.to as Square));
    setDraggingPiece(piece);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragOffset({ x: 0, y: 0 });
    if (boardRef.current) boardRef.current.setPointerCapture(e.pointerId);
  }, [promotionPending, chess]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPiece) {
      setDragOffset({ x: e.clientX - dragStartPos.x, y: e.clientY - dragStartPos.y });
    } else if (rightClickStartSquare && boardRef.current) {
      const hoverSq = getSquareFromPosition(e.clientX, e.clientY);
      if (hoverSq && hoverSq !== rightClickStartSquare) {
        setArrowPreview({ from: rightClickStartSquare, to: hoverSq });
      } else {
        setArrowPreview(null);
      }
    }
  }, [draggingPiece, dragStartPos, rightClickStartSquare, getSquareFromPosition]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPiece) {
      if (boardRef.current) boardRef.current.releasePointerCapture(e.pointerId);
      const targetSq = getSquareFromPosition(e.clientX, e.clientY);
      const wasDragged = Math.abs(dragOffset.x) > 10 || Math.abs(dragOffset.y) > 10;
      if (targetSq && targetSq !== draggingPiece.square && legalMoves.includes(targetSq)) {
        handleMove(draggingPiece.square, targetSq);
      } else if (!wasDragged) {
        // simple click handled elsewhere
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      setDraggingPiece(null);
      setDragOffset({ x: 0, y: 0 });
    }
  }, [draggingPiece, dragOffset, getSquareFromPosition, legalMoves, handleMove]);

  // Right-click arrows/circles
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
        if (rightClickStartSquare === targetSq) {
          addCircle({ square: targetSq, color: 'red' });
        } else {
          addArrow({ from: rightClickStartSquare, to: targetSq, color: 'green' });
        }
      }
      setRightClickStartSquare(null);
      setArrowPreview(null);
    }
  }, [rightClickStartSquare, getSquareFromPosition, addCircle, addArrow]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      clearDrawing();
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [clearDrawing]);

  // Animation duration
  const getSpeed = useCallback(() => {
    if (reducedMotion) return 0;
    if (animationSpeed === 'slow') return 0.35;
    if (animationSpeed === 'fast') return 0.08;
    return 0.15;
  }, [reducedMotion, animationSpeed]);

  // Checked king
  const checkedKingSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const boardState = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = boardState[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          return (files[c] + ranks[r]) as Square;
        }
      }
    }
    return null;
  }, [chess, files, ranks]);

  // Board colors
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
    const margin = 4.2;
    return { x1, y1, x2: x2 - (dx / len) * margin, y2: y2 - (dy / len) * margin };
  }, [getSquareCoordinates]);

  return (
    <div className="relative w-full max-w-[700px] select-none touch-none">
      {/* Coordinates - Top (files) */}
      {showCoordinates && (
        <div className="flex w-full mb-0.5">
          {Array.from({ length: 8 }).map((_, colIdx) => {
            const fIdx = boardOrientation === 'white' ? colIdx : 7 - colIdx;
            return (
              <div key={colIdx} className="flex-1 text-center">
                <span className="text-[10px] font-medium text-l-text-dim select-none">
                  {files[fIdx]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex">
        {/* Coordinates - Left (ranks) */}
        {showCoordinates && (
          <div className="flex flex-col w-5 mr-0.5" style={{ aspectRatio: '1/8' }}>
            {Array.from({ length: 8 }).map((_, rowIdx) => {
              const rIdx = boardOrientation === 'white' ? rowIdx : 7 - rowIdx;
              return (
                <div key={rowIdx} className="flex-1 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-l-text-dim select-none">
                    {ranks[rIdx]}
                  </span>
                </div>
              );
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
          onPointerMove={handlePointerMove}
          onClick={handleBackgroundClick}
        >
          {/* 1. Grid of Squares */}
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

              let bgOverlay = '';
              if (isCheck) bgOverlay = 'bg-[rgba(255,0,0,0.5)]';
              else if (isLastMoveSrc || isLastMoveDst) bgOverlay = 'bg-[rgba(255,255,50,0.4)]';
              else if (isSelected) bgOverlay = 'bg-[rgba(20,85,30,0.35)]';

              return (
                <div
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); handleSquareClick(sq); }}
                  className="relative w-full h-full"
                  style={{ backgroundColor: isLight ? themeColors.light : themeColors.dark }}
                >
                  {bgOverlay && <div className={`absolute inset-0 ${bgOverlay}`} />}

                  {/* Legal move dots */}
                  {legalMoves.includes(sq) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      {chess.get(sq) ? (
                        <div className="w-[88%] h-[88%] rounded-full border-[3.5px] border-[rgba(0,0,0,0.15)]" />
                      ) : (
                        <div className="w-[26%] h-[26%] rounded-full bg-[rgba(0,0,0,0.15)]" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 2. Pieces Layer */}
          <div className="absolute inset-0 pointer-events-none z-20">
            <AnimatePresence>
              {pieces.map((piece) => {
                const { x, y } = getSquareCoordinates(piece.square);
                const isDragging = draggingPiece?.id === piece.id;

                return (
                  <motion.div
                    key={piece.id}
                    layoutId={reducedMotion ? undefined : piece.id}
                    transition={isDragging ? { duration: 0 } : { type: 'tween', ease: 'easeInOut', duration: getSpeed() }}
                    className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
                    style={{
                      width: '12.5%',
                      height: '12.5%',
                      top: `${y * 12.5}%`,
                      left: `${x * 12.5}%`,
                      x: isDragging ? dragOffset.x : 0,
                      y: isDragging ? dragOffset.y : 0,
                      zIndex: isDragging ? 50 : 30,
                    }}
                    onPointerDown={(e) => handlePointerDown(e, piece)}
                    onPointerUp={handlePointerUp}
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

          {/* 3. SVG Arrow & Highlight Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-40 fill-none" viewBox="0 0 100 100">
            <defs>
              <marker id="arrowhead-green" markerWidth="6" markerHeight="6" refX="2" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="rgba(98, 153, 36, 0.8)" />
              </marker>
              <marker id="arrowhead-red" markerWidth="6" markerHeight="6" refX="2" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="rgba(204, 139, 44, 0.8)" />
              </marker>
            </defs>

            {circles.map((c, i) => {
              const coords = getSquareCoordinates(c.square as Square);
              return (
                <circle
                  key={`circle-${i}`}
                  cx={(coords.x + 0.5) * 12.5}
                  cy={(coords.y + 0.5) * 12.5}
                  r="5.5"
                  stroke="rgba(204, 139, 44, 0.8)"
                  strokeWidth="1.2"
                  fill="none"
                />
              );
            })}

            {arrows.map((a, i) => {
              const { x1, y1, x2, y2 } = getArrowCoords(a);
              return (
                <line
                  key={`arrow-${i}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(98, 153, 36, 0.8)"
                  strokeWidth="1.6"
                  markerEnd="url(#arrowhead-green)"
                />
              );
            })}

            {arrowPreview && (() => {
              const { x1, y1, x2, y2 } = getArrowCoords(arrowPreview);
              return (
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(98, 153, 36, 0.6)"
                  strokeWidth="1.4"
                  markerEnd="url(#arrowhead-green)"
                />
              );
            })()}
          </svg>

          {/* 4. Promotion Dialog */}
          {promotionPending && (() => {
            const color = chess.turn();
            const options: ('q' | 'r' | 'b' | 'n')[] = ['q', 'r', 'b', 'n'];
            return (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
                <div className="bg-[#312E2B] border border-white/10 p-4 rounded-lg flex flex-col items-center gap-3 shadow-xl">
                  <p className="text-sm font-medium text-l-text-muted">Promote to</p>
                  <div className="flex gap-2">
                    {options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => executeMove(promotionPending.from, promotionPending.to, opt)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-150 cursor-pointer"
                      >
                        <img
                          src={`./assets/pieces/${color}${opt.toUpperCase()}.svg`}
                          alt={opt}
                          className="w-12 h-12"
                        />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPromotionPending(null)}
                    className="mt-1 text-xs text-l-text-dim hover:text-l-text transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Coordinates - Right (ranks) */}
        {showCoordinates && (
          <div className="flex flex-col w-5 ml-0.5" style={{ aspectRatio: '1/8' }}>
            {Array.from({ length: 8 }).map((_, rowIdx) => {
              const rIdx = boardOrientation === 'white' ? rowIdx : 7 - rowIdx;
              return (
                <div key={rowIdx} className="flex-1 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-l-text-dim select-none">
                    {ranks[rIdx]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Coordinates - Bottom (files) */}
      {showCoordinates && (
        <div className="flex w-full mt-0.5">
          {Array.from({ length: 8 }).map((_, colIdx) => {
            const fIdx = boardOrientation === 'white' ? colIdx : 7 - colIdx;
            return (
              <div key={colIdx} className="flex-1 text-center">
                <span className="text-[10px] font-medium text-l-text-dim select-none">
                  {files[fIdx]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
