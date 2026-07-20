import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chess, Square } from 'chess.js';
import { useChessStore, useSettingsStore, BoardTheme } from '../../stores/chessStore';
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
  const interactiveMode = useChessStore((s) => s.interactiveMode);
  
  const arrows = useChessStore((s) => s.arrows);
  const circles = useChessStore((s) => s.circles);
  const addArrow = useChessStore((s) => s.addArrow);
  const addCircle = useChessStore((s) => s.addCircle);
  const clearDrawing = useChessStore((s) => s.clearDrawing);
  const setDrawing = useChessStore((s) => s.setDrawing);

  const checkPracticeMove = useChessStore((s) => s.checkPracticeMove);
  const submitQuizMove = useChessStore((s) => s.submitQuizMove);

  const { boardTheme, showCoordinates, animationSpeed, reducedMotion } = useSettingsStore();

  const boardRef = useRef<HTMLDivElement>(null);

  // Local state for chess.js validation
  const [chess, setChess] = useState(new Chess(currentFen));
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  // Drag and drop state
  const [draggingPiece, setDraggingPiece] = useState<BoardPiece | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  // Right-click arrow drawing state
  const [rightClickStartSquare, setRightClickStartSquare] = useState<Square | null>(null);
  const [rightClickCurrentSquare, setRightClickCurrentSquare] = useState<Square | null>(null);
  const [arrowPreview, setArrowPreview] = useState<{ from: Square; to: Square } | null>(null);

  // Promotion popup state
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

  // Sync chess.js engine with store FEN
  useEffect(() => {
    const nextChess = new Chess(currentFen);
    setChess(nextChess);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [currentFen]);

  // Sync piece representation with IDs for Framer Motion sliding
  useEffect(() => {
    const boardState = chess.board();
    const newPieces: BoardPiece[] = [];

    // Parse active pieces from the board
    boardState.forEach((row, rIdx) => {
      row.forEach((col, cIdx) => {
        if (col) {
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
          const sq = (files[cIdx] + ranks[rIdx]) as Square;
          newPieces.push({
            id: '', // to be matched
            type: col.type,
            color: col.color,
            square: sq,
          });
        }
      });
    });

    // Match with previous pieces to preserve IDs (smooth animations)
    setPieces((prevPieces) => {
      const matched: BoardPiece[] = [];
      const usedPrevIds = new Set<string>();

      // 1. First match exact square, type, and color
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

      // 2. Match moved piece (using lastMove if available)
      newPieces.forEach((np) => {
        if (np.id) return; // already matched

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

        // Broad search for same piece type/color that disappeared from elsewhere (e.g. castling Rooks, or standard moves without lastMove)
        const prevMatch = prevPieces.find(
          (pp) => pp.type === np.type && pp.color === np.color && !usedPrevIds.has(pp.id) && !newPieces.some(x => x.square === pp.square && x.type === pp.type && x.color === pp.color)
        );
        if (prevMatch) {
          np.id = prevMatch.id;
          matched.push(np);
          usedPrevIds.add(prevMatch.id);
        } else {
          // New piece (e.g. promotion or setup)
          np.id = Math.random().toString(36).substring(2, 9);
          matched.push(np);
        }
      });

      return matched;
    });
  }, [chess]);

  // Coordinate utilities
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const getSquareCoordinates = (sq: Square) => {
    const fIdx = files.indexOf(sq[0]);
    const rIdx = ranks.indexOf(sq[1]);
    const x = boardOrientation === 'white' ? fIdx : 7 - fIdx;
    const y = boardOrientation === 'white' ? rIdx : 7 - rIdx;
    return { x, y };
  };

  const getSquareFromPosition = (clientX: number, clientY: number): Square | null => {
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
  };

  // Move trigger helper
  const handleMove = (from: Square, to: Square, promotionPiece = 'q') => {
    // Check if promotion is needed
    const piece = chess.get(from);
    if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      setPromotionPending({ from, to });
      return;
    }

    executeMove(from, to, promotionPiece);
  };

  const executeMove = (from: Square, to: Square, promo = 'q') => {
    let success = false;

    if (interactiveMode === 'practice') {
      success = checkPracticeMove(from, to, promo);
    } else if (interactiveMode === 'quiz') {
      success = submitQuizMove(from, to, promo);
    } else {
      // Normal free play (theory / editor)
      try {
        const nextChess = new Chess(chess.fen());
        const move = nextChess.move({ from, to, promotion: promo });
        
        if (move.captured || move.san.includes('x')) {
          sound.playCapture();
        } else {
          sound.playMove();
        }

        if (nextChess.inCheck()) {
          sound.playCheck();
        }

        success = true;
        // Update store FEN directly
        useChessStore.getState().setFen(nextChess.fen());
        useChessStore.getState().setLastMove({ from, to });
      } catch (err) {
        success = false;
      }
    }

    useChessStore.getState().clearDrawing();
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionPending(null);
  };

  // Click handler
  const handleSquareClick = (sq: Square) => {
    if (promotionPending) return;

    if (selectedSquare === sq) {
      clearDrawing();
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // If a legal move target is clicked
    if (legalMoves.includes(sq) && selectedSquare) {
      handleMove(selectedSquare, sq);
      return;
    }

    // Select piece
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
  };

  // Pointer drag events
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, piece: BoardPiece) => {
    if (e.button !== 0) return; // Only left click drags
    if (promotionPending) return;

    e.preventDefault();
    setSelectedSquare(piece.square);
    const moves = chess.moves({ square: piece.square, verbose: true }) as any[];
    setLegalMoves(moves.map((m) => m.to as Square));

    setDraggingPiece(piece);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragOffset({ x: 0, y: 0 });

    if (boardRef.current) {
      boardRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPiece) {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      setDragOffset({ x: dx, y: dy });
    } else if (rightClickStartSquare && boardRef.current) {
      // Arrow drawing preview
      const hoverSq = getSquareFromPosition(e.clientX, e.clientY);
      if (hoverSq && hoverSq !== rightClickStartSquare) {
        setRightClickCurrentSquare(hoverSq);
        setArrowPreview({ from: rightClickStartSquare, to: hoverSq });
      } else {
        setArrowPreview(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPiece) {
      if (boardRef.current) {
        boardRef.current.releasePointerCapture(e.pointerId);
      }

      const targetSq = getSquareFromPosition(e.clientX, e.clientY);
      const wasDragged = Math.abs(dragOffset.x) > 10 || Math.abs(dragOffset.y) > 10;

      if (targetSq && targetSq !== draggingPiece.square && legalMoves.includes(targetSq)) {
        handleMove(draggingPiece.square, targetSq);
      } else if (!wasDragged) {
        // Simple click — pointerdown already set selection state;
        // the subsequent click event will handle deselection via the board.
      } else {
        // Reset selections if dragged off board or onto illegal square
        setSelectedSquare(null);
        setLegalMoves([]);
      }

      setDraggingPiece(null);
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Right-click Drawing Event Handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent context menu
  };

  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      // Right click down
      const sq = getSquareFromPosition(e.clientX, e.clientY);
      if (sq) {
        setRightClickStartSquare(sq);
        setRightClickCurrentSquare(sq);
      }
    }
  };

  const handleBoardMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2 && rightClickStartSquare) {
      const targetSq = getSquareFromPosition(e.clientX, e.clientY);
      if (targetSq) {
        if (rightClickStartSquare === targetSq) {
          // Toggle circle
          addCircle({ square: targetSq, color: 'red' });
        } else {
          // Add arrow
          addArrow({ from: rightClickStartSquare, to: targetSq, color: 'green' });
        }
      }
      setRightClickStartSquare(null);
      setRightClickCurrentSquare(null);
      setArrowPreview(null);
    }
  };

  // Clear drawing on simple left click on board background
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.button === 0) {
      clearDrawing();
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  // Animation duration
  const getSpeed = () => {
    if (reducedMotion) return 0;
    if (animationSpeed === 'slow') return 0.35;
    if (animationSpeed === 'fast') return 0.08;
    return 0.16; // normal
  };

  // Determine checked King square
  const getCheckedKingSquare = (): Square | null => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const boardState = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = boardState[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
          return (files[c] + ranks[r]) as Square;
        }
      }
    }
    return null;
  };

  const checkedKingSquare = getCheckedKingSquare();

  // Color mappings for themes
  const themeColors = {
    lichess: { light: 'bg-[#eeeed2] text-[#769656]', dark: 'bg-[#769656] text-[#eeeed2]' },
    wood: { light: 'bg-[#f0d9b5] text-[#b58863]', dark: 'bg-[#b58863] text-[#f0d9b5]' },
    dark: { light: 'bg-[#e2e4e6] text-[#3b4252]', dark: 'bg-[#3b4252] text-[#e2e4e6]' },
    midnight: { light: 'bg-[#e4ecf5] text-[#4c709c]', dark: 'bg-[#4c709c] text-[#e4ecf5]' },
    emerald: { light: 'bg-[#eeeed2] text-[#005c2a]', dark: 'bg-[#005c2a] text-[#eeeed2]' },
  }[boardTheme] || { light: 'bg-[#eeeed2] text-[#769656]', dark: 'bg-[#769656] text-[#eeeed2]' };

  const getArrowCoords = (arrow: { from: string; to: string }) => {
    const fromCoords = getSquareCoordinates(arrow.from as Square);
    const toCoords = getSquareCoordinates(arrow.to as Square);

    const x1 = (fromCoords.x + 0.5) * 12.5;
    const y1 = (fromCoords.y + 0.5) * 12.5;
    const x2 = (toCoords.x + 0.5) * 12.5;
    const y2 = (toCoords.y + 0.5) * 12.5;

    // Shorten the arrow line to sit nicely behind piece
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len === 0) return { x1, y1, x2, y2 };

    const margin = 4.2; // square margin percentage
    const x2_short = x2 - (dx / len) * margin;
    const y2_short = y2 - (dy / len) * margin;

    return { x1, y1, x2: x2_short, y2: y2_short };
  };

  return (
    <div className="relative w-full max-w-[700px] select-none touch-none">
      {/* Board Aspect Frame */}
      <div
        ref={boardRef}
        className="relative w-full aspect-square rounded-xl shadow-2xl overflow-hidden cursor-pointer"
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

            return (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSquareClick(sq);
                }}
                className={`relative w-full h-full transition-colors duration-150 ${
                  isLight ? themeColors.light : themeColors.dark
                } ${
                  isSelected ? 'after:absolute after:inset-0 after:bg-blue-500/35' : ''
                } ${
                  isLastMoveSrc || isLastMoveDst ? 'after:absolute after:inset-0 after:bg-amber-400/25' : ''
                } ${
                  isCheck ? 'after:absolute after:inset-0 after:bg-radial after:from-red-600/75 after:to-transparent' : ''
                }`}
              >
                {/* Coordinates */}
                {showCoordinates && (
                  <>
                    {/* Rank numbers (shown only on column 0) */}
                    {colIdx === 0 && (
                      <span className="absolute top-1 left-1 text-[10px] md:text-xs font-semibold font-mono opacity-50">
                        {ranks[rIdx]}
                      </span>
                    )}
                    {/* File letters (shown only on bottom row) */}
                    {rowIdx === 7 && (
                      <span className="absolute bottom-1 right-1 text-[10px] md:text-xs font-semibold font-mono opacity-50">
                        {files[fIdx]}
                      </span>
                    )}
                  </>
                )}

                {/* Legal move circles */}
                {legalMoves.includes(sq) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    {chess.get(sq) ? (
                      // Captured target ring
                      <div className="w-[85%] h-[85%] rounded-full border-[6px] border-white/30" />
                    ) : (
                      // Open space landing dot
                      <div className="w-4 h-4 rounded-full bg-white/30" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 2. Pieces Layer (Framer Motion) */}
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
                    className="w-full h-full drop-shadow-md select-none pointer-events-none"
                    draggable={false}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* 3. SVG Arrow & Highlight Layer */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-40 fill-none"
          viewBox="0 0 100 100"
        >
          <defs>
            <marker
              id="arrowhead-green"
              markerWidth="6"
              markerHeight="6"
              refX="2"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="rgba(34, 197, 94, 0.75)" />
            </marker>
          </defs>

          {/* Highlight circles */}
          {circles.map((c, i) => {
            const coords = getSquareCoordinates(c.square as Square);
            return (
              <circle
                key={`circle-${i}`}
                cx={(coords.x + 0.5) * 12.5}
                cy={(coords.y + 0.5) * 12.5}
                r="5.5"
                stroke="rgba(239, 68, 68, 0.75)"
                strokeWidth="1.2"
                fill="none"
              />
            );
          })}

          {/* Stored arrows */}
          {arrows.map((a, i) => {
            const { x1, y1, x2, y2 } = getArrowCoords(a);
            return (
              <line
                key={`arrow-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(34, 197, 94, 0.75)"
                strokeWidth="1.6"
                markerEnd="url(#arrowhead-green)"
              />
            );
          })}

          {/* Arrow preview */}
          {arrowPreview && (() => {
            const { x1, y1, x2, y2 } = getArrowCoords(arrowPreview);
            return (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(34, 197, 94, 0.75)"
                strokeWidth="1.6"
                markerEnd="url(#arrowhead-green)"
              />
            );
          })()}
        </svg>

        {/* 4. Pawn Promotion Dialog HUD Overlay */}
        {promotionPending && (() => {
          const { x, y } = getSquareCoordinates(promotionPending.to);
          const color = chess.turn();
          const options: ('q' | 'r' | 'b' | 'n')[] = ['q', 'r', 'b', 'n'];

          // Place the promotion popup centered near the promotion square
          return (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
              <div className="bg-[#1b1e24] border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-3 shadow-2xl">
                <p className="text-sm font-semibold text-gray-300">Promote Pawn</p>
                <div className="flex gap-2">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => executeMove(promotionPending.from, promotionPending.to, opt)}
                      className="p-2 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl transition duration-150 cursor-pointer"
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
                  className="mt-1 text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
