import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chess, Square } from 'chess.js';
import { useChessStore, useSettingsStore } from '../../stores/chessStore';
import { sound } from '../../services/soundService';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BoardPiece {
  id: string;
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  square: Square;
}

type InteractionPhase = 'idle' | 'pressed' | 'dragging';

// ── Constants ──────────────────────────────────────────────────────────────────

const OLIVE = 'rgba(98, 113, 53,';

const Z = { SQUARE: 1, HIGHLIGHT: 100, SNAP: 105, LEGAL: 110, PIECE: 200, ARROW: 300, PROMO: 900, DRAG: 1000 } as const;

const DRAG_THRESHOLD = 4;
const SNAP_MARGIN = 0.175;
const SNAPBACK_MS = 110;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// ── Component ──────────────────────────────────────────────────────────────────

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
  const { boardTheme, showCoordinates } = useSettingsStore();

  // ── DOM Refs ───────────────────────────────────────────────────────────────

  const boardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const snapHighlightRef = useRef<HTMLDivElement>(null);

  // ── Interaction Refs ───────────────────────────────────────────────────────

  const phase = useRef<InteractionPhase>('idle');
  const pressStart = useRef({ x: 0, y: 0 });
  const pressPiece = useRef<BoardPiece | null>(null);
  const snapSquareRef = useRef<Square | null>(null);
  const legalSet = useRef(new Set<Square>());
  const skipClick = useRef(false);
  const snapbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set true on legal drag-drop; cleared after FEN updates to prevent snap-back
  const pendingDragClear = useRef(false);

  // ── React State ────────────────────────────────────────────────────────────

  const [chess, setChess] = useState(new Chess(currentFen));
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [dragSource, setDragSource] = useState<Square | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

  // ── Sync chess.js ──────────────────────────────────────────────────────────

  useEffect(() => {
    setChess(new Chess(currentFen));
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [currentFen]);

  useEffect(() => { legalSet.current = new Set(legalMoves); }, [legalMoves]);

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelAll();
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); flipBoard(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipBoard]);

  // ── Piece sync — single source of truth ────────────────────────────────────

  useEffect(() => {
    const board = chess.board();
    const next: BoardPiece[] = [];
    board.forEach((row, r) => row.forEach((col, c) => {
      if (col) next.push({ id: '', type: col.type, color: col.color, square: (FILES[c] + RANKS[r]) as Square });
    }));

    setPieces((prev) => {
      const matched: BoardPiece[] = [];
      const used = new Set<string>();

      // 1. Exact position match
      next.forEach((np) => {
        const m = prev.find((pp) => pp.square === np.square && pp.type === np.type && pp.color === np.color && !used.has(pp.id));
        if (m) { np.id = m.id; matched.push(np); used.add(m.id); }
      });

      // 2. Moved piece match
      next.forEach((np) => {
        if (np.id) return;
        if (lastMove && np.square === lastMove.to) {
          const m = prev.find((pp) => pp.square === lastMove.from && pp.type === np.type && pp.color === np.color && !used.has(pp.id));
          if (m) { np.id = m.id; matched.push(np); used.add(m.id); return; }
        }
        const m = prev.find((pp) => pp.type === np.type && pp.color === np.color && !used.has(pp.id)
          && !next.some(x => x.square === pp.square && x.type === pp.type && x.color === pp.color));
        if (m) { np.id = m.id; matched.push(np); used.add(m.id); }
        else { np.id = Math.random().toString(36).substring(2, 9); matched.push(np); }
      });
      return matched;
    });

    // Clear drag source AFTER pieces are at their new positions (prevents snap-back)
    if (pendingDragClear.current) {
      pendingDragClear.current = false;
      setDragSource(null);
      setIsDragging(false);
    }
  }, [chess]);

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  const getCoords = useCallback((sq: Square) => {
    const fi = FILES.indexOf(sq[0]);
    const ri = RANKS.indexOf(sq[1]);
    return { x: boardOrientation === 'white' ? fi : 7 - fi, y: boardOrientation === 'white' ? ri : 7 - ri };
  }, [boardOrientation]);

  const sqFromClient = useCallback((cx: number, cy: number): Square | null => {
    if (!boardRef.current) return null;
    const r = boardRef.current.getBoundingClientRect();
    const rx = cx - r.left, ry = cy - r.top;
    if (rx < 0 || rx > r.width || ry < 0 || ry > r.height) return null;
    const col = Math.floor(rx / r.width * 8), row = Math.floor(ry / r.height * 8);
    const fi = boardOrientation === 'white' ? col : 7 - col;
    const ri = boardOrientation === 'white' ? row : 7 - row;
    return (fi >= 0 && fi < 8 && ri >= 0 && ri < 8) ? (FILES[fi] + RANKS[ri]) as Square : null;
  }, [boardOrientation]);

  const snapFromClient = useCallback((cx: number, cy: number): Square | null => {
    if (!boardRef.current) return null;
    const r = boardRef.current.getBoundingClientRect();
    const rx = cx - r.left, ry = cy - r.top;
    if (rx < 0 || rx > r.width || ry < 0 || ry > r.height) return null;
    const sq = r.width / 8;
    const col = Math.floor(rx / sq), row = Math.floor(ry / sq);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const fx = (rx - col * sq) / sq, fy = (ry - row * sq) / sq;
    if (fx < SNAP_MARGIN || fx > 1 - SNAP_MARGIN || fy < SNAP_MARGIN || fy > 1 - SNAP_MARGIN) return snapSquareRef.current;
    const fi = boardOrientation === 'white' ? col : 7 - col;
    const ri = boardOrientation === 'white' ? row : 7 - row;
    if (fi >= 0 && fi < 8 && ri >= 0 && ri < 8) { const s = (FILES[fi] + RANKS[ri]) as Square; snapSquareRef.current = s; return s; }
    return snapSquareRef.current;
  }, [boardOrientation]);

  // ── Direct DOM helpers ─────────────────────────────────────────────────────

  const positionFloat = useCallback((cx: number, cy: number) => {
    if (!floatingRef.current || !containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    const sqW = boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 : 60;
    const half = sqW / 2; // Same size as on-board piece (12.5% of board)
    floatingRef.current.style.left = `${cx - cr.left - half}px`;
    floatingRef.current.style.top = `${cy - cr.top - half}px`;
  }, []);

  const updateSnapHL = useCallback((sq: Square | null) => {
    const el = snapHighlightRef.current;
    if (!el) return;
    if (!sq) { el.style.opacity = '0'; return; }
    const c = getCoords(sq);
    el.style.left = `${c.x * 12.5}%`;
    el.style.top = `${c.y * 12.5}%`;
    el.style.opacity = '1';
  }, [getCoords]);

  // ── Selection ──────────────────────────────────────────────────────────────

  const select = useCallback((sq: Square) => {
    setSelectedSquare(sq);
    const m = chess.moves({ square: sq, verbose: true }) as any[];
    setLegalMoves(m.map((x) => x.to as Square));
  }, [chess]);

  const cancelAll = useCallback(() => {
    phase.current = 'idle';
    pressPiece.current = null;
    snapSquareRef.current = null;
    pendingDragClear.current = false;
    if (snapbackTimer.current) { clearTimeout(snapbackTimer.current); snapbackTimer.current = null; }
    setIsDragging(false);
    setDragSource(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionPending(null);
    updateSnapHL(null);
  }, [updateSnapHL]);

  // ── Move execution ─────────────────────────────────────────────────────────

  const executeMove = useCallback((from: Square, to: Square, promo = 'q') => {
    const mode = useChessStore.getState().interactiveMode;
    if (mode === 'practice') { checkPracticeMove(from, to, promo); }
    else if (mode === 'quiz') { submitQuizMove(from, to, promo); }
    else {
      try {
        const next = new Chess(chess.fen());
        const mv = next.move({ from, to, promotion: promo });
        if (mv.captured || mv.san.includes('x')) sound.playCapture();
        else if (mv.san === 'O-O' || mv.san === 'O-O-O') sound.playCastle();
        else sound.playMove();
        if (next.inCheck()) sound.playCheck();
        if (next.isCheckmate()) sound.playCheckmate();
        else if (next.isGameOver()) sound.playSuccess();
        useChessStore.getState().setFen(next.fen());
        useChessStore.getState().setLastMove({ from, to });
      } catch { /* illegal */ }
    }
    clearDrawing();
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionPending(null);
  }, [chess, checkPracticeMove, submitQuizMove, clearDrawing]);

  const tryMove = useCallback((from: Square, to: Square, promo = 'q') => {
    const p = chess.get(from);
    if (p?.type === 'p' && (to[1] === '8' || to[1] === '1')) { setPromotionPending({ from, to }); return; }
    executeMove(from, to, promo);
  }, [chess, executeMove]);

  // ── Pointer handlers ───────────────────────────────────────────────────────

  const onPiecePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, piece: BoardPiece) => {
    if (e.button !== 0 || promotionPending) return;
    e.preventDefault();
    e.stopPropagation();

    skipClick.current = true;
    clearDrawing();

    // Legal capture on selected piece → execute immediately
    if (selectedSquare && selectedSquare !== piece.square && legalSet.current.has(piece.square)) {
      tryMove(selectedSquare, piece.square);
      return;
    }

    // Select this piece
    select(piece.square);

    // Enter pressed phase (not dragging yet)
    phase.current = 'pressed';
    pressPiece.current = piece;
    pressStart.current = { x: e.clientX, y: e.clientY };
    snapSquareRef.current = null;

    if (boardRef.current) boardRef.current.setPointerCapture(e.pointerId);
  }, [promotionPending, selectedSquare, chess, clearDrawing, select, tryMove]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (phase.current === 'pressed' && pressPiece.current) {
      const dx = e.clientX - pressStart.current.x;
      const dy = e.clientY - pressStart.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        phase.current = 'dragging';
        setIsDragging(true);
        setDragSource(pressPiece.current.square);
        positionFloat(e.clientX, e.clientY);
      }
      return;
    }

    if (phase.current === 'dragging') {
      positionFloat(e.clientX, e.clientY);
      const sq = snapFromClient(e.clientX, e.clientY);
      updateSnapHL(sq);
    }
  }, [positionFloat, snapFromClient, updateSnapHL]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    if (boardRef.current) {
      try { boardRef.current.releasePointerCapture(e.pointerId); } catch {}
    }

    // Drag release
    if (phase.current === 'dragging' && pressPiece.current) {
      const target = snapFromClient(e.clientX, e.clientY);
      const piece = pressPiece.current;

      phase.current = 'idle';
      updateSnapHL(null);

      if (target && target !== piece.square && legalSet.current.has(target)) {
        // Legal drop: hide floating piece, commit move
        // dragSource stays set (piece hidden) until FEN updates in the chess useEffect
        pendingDragClear.current = true;
        setIsDragging(false);
        pressPiece.current = null;
        snapSquareRef.current = null;
        tryMove(piece.square, target);
        return;
      }

      // Illegal drop: snapback
      sound.playIllegal();
      if (floatingRef.current && boardRef.current && containerRef.current) {
        const bRect = boardRef.current.getBoundingClientRect();
        const cRect = containerRef.current.getBoundingClientRect();
        const c = getCoords(piece.square);
        const sqW = bRect.width / 8;
        const half = sqW / 2;
        const targetX = bRect.left - cRect.left + (c.x + 0.5) * sqW - half;
        const targetY = bRect.top - cRect.top + (c.y + 0.5) * sqW - half;

        const el = floatingRef.current;
        el.style.transition = `left ${SNAPBACK_MS}ms ease-out, top ${SNAPBACK_MS}ms ease-out`;
        el.style.left = `${targetX}px`;
        el.style.top = `${targetY}px`;

        snapbackTimer.current = setTimeout(() => {
          el.style.transition = '';
          setDragSource(null);
          setIsDragging(false);
          setSelectedSquare(null);
          setLegalMoves([]);
          pressPiece.current = null;
          snapSquareRef.current = null;
          snapbackTimer.current = null;
        }, SNAPBACK_MS);
      } else {
        setDragSource(null);
        setIsDragging(false);
        setSelectedSquare(null);
        setLegalMoves([]);
        pressPiece.current = null;
        snapSquareRef.current = null;
      }
      return;
    }

    // Click release (not dragged)
    if (phase.current === 'pressed' && pressPiece.current) {
      const piece = pressPiece.current;
      phase.current = 'idle';
      pressPiece.current = null;
      if (selectedSquare === piece.square) {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return;
    }

    phase.current = 'idle';
    pressPiece.current = null;
  }, [selectedSquare, getCoords, snapFromClient, updateSnapHL, tryMove]);

  // ── Square click ───────────────────────────────────────────────────────────

  const onSquareClick = useCallback((sq: Square) => {
    if (promotionPending) return;
    if (skipClick.current) { skipClick.current = false; return; }
    clearDrawing();

    if (selectedSquare && legalSet.current.has(sq) && selectedSquare !== sq) {
      tryMove(selectedSquare, sq);
      return;
    }

    setSelectedSquare(null);
    setLegalMoves([]);
  }, [promotionPending, selectedSquare, clearDrawing, tryMove]);

  // ── Right-click ────────────────────────────────────────────────────────────

  const rcStart = useRef<Square | null>(null);

  const onBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { const sq = sqFromClient(e.clientX, e.clientY); if (sq) rcStart.current = sq; }
  }, [sqFromClient]);

  const onBgMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2 && rcStart.current) {
      const sq = sqFromClient(e.clientX, e.clientY);
      if (sq) {
        if (rcStart.current === sq) addCircle({ square: sq, color: 'green' });
        else addArrow({ from: rcStart.current, to: sq, color: 'green' });
      }
      rcStart.current = null;
    }
  }, [sqFromClient, addCircle, addArrow]);

  const onBgClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      if (skipClick.current) { skipClick.current = false; return; }
      clearDrawing(); setSelectedSquare(null); setLegalMoves([]);
    }
  }, [clearDrawing]);

  const onContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const checkedKing = useMemo(() => {
    if (!chess.inCheck()) return null;
    const t = chess.turn();
    const b = chess.board();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c]; if (p && p.type === 'k' && p.color === t) return (FILES[c] + RANKS[r]) as Square;
    }
    return null;
  }, [chess]);

  const themeColors = useMemo(() => {
    const m: Record<string, { light: string; dark: string }> = {
      lichess: { light: '#eeeed2', dark: '#769656' },
      wood: { light: '#F0D9B5', dark: '#B58863' },
      dark: { light: '#C6C6C6', dark: '#7B7B7B' },
      midnight: { light: '#C8D6E5', dark: '#576574' },
      emerald: { light: '#D4E6C3', dark: '#5A8A3C' },
    };
    return m[boardTheme] || m.wood;
  }, [boardTheme]);

  const arrowCoords = useCallback((a: { from: string; to: string }) => {
    const f = getCoords(a.from as Square), t = getCoords(a.to as Square);
    const x1 = (f.x + 0.5) * 12.5, y1 = (f.y + 0.5) * 12.5;
    const x2 = (t.x + 0.5) * 12.5, y2 = (t.y + 0.5) * 12.5;
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x1, y1, x2, y2 };
    const m = 5;
    return { x1, y1, x2: x2 - (dx / len) * m, y2: y2 - (dy / len) * m };
  }, [getCoords]);

  const dragSrc = dragSource
    ? `./assets/pieces/${pieces.find(p => p.square === dragSource)?.color}${pieces.find(p => p.square === dragSource)?.type.toUpperCase()}.svg`
    : '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative w-full max-w-[700px] select-none touch-none">

      {/* Floating drag piece — same size as on-board, no scale */}
      {isDragging && (
        <div ref={floatingRef} className="absolute pointer-events-none"
          style={{
            width: `${100 / 8}%`, height: `${100 / 8}%`, // 12.5% — same as on-board
            zIndex: Z.DRAG, opacity: 1,
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.30))',
            willChange: 'left, top', cursor: 'grabbing',
            transition: 'none',
          }}>
          <img src={dragSrc} alt="" className="w-full h-full select-none pointer-events-none" draggable={false} />
        </div>
      )}

      {/* Coordinates: Top */}
      {showCoordinates && (
        <div className="flex w-full mb-0.5">
          {Array.from({ length: 8 }).map((_, i) => {
            const fi = boardOrientation === 'white' ? i : 7 - i;
            return <div key={i} className="flex-1 text-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{FILES[fi]}</span></div>;
          })}
        </div>
      )}

      <div className="flex">
        {showCoordinates && (
          <div className="flex flex-col w-5 mr-0.5" style={{ aspectRatio: '1/8' }}>
            {Array.from({ length: 8 }).map((_, i) => {
              const ri = boardOrientation === 'white' ? i : 7 - i;
              return <div key={i} className="flex-1 flex items-center justify-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{RANKS[ri]}</span></div>;
            })}
          </div>
        )}

        {/* Board */}
        <div ref={boardRef} className="relative w-full aspect-square overflow-hidden"
          style={{ cursor: phase.current === 'dragging' ? 'grabbing' : 'default' }}
          onContextMenu={onContextMenu} onMouseDown={onBgMouseDown} onMouseUp={onBgMouseUp}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={onBgClick}>

          {/* Squares */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8" style={{ zIndex: Z.SQUARE }}>
            {Array.from({ length: 64 }).map((_, idx) => {
              const ri = Math.floor(idx / 8), ci = idx % 8;
              const fi = boardOrientation === 'white' ? ci : 7 - ci;
              const rri = boardOrientation === 'white' ? ri : 7 - ri;
              const sq = (FILES[fi] + RANKS[rri]) as Square;
              const isLight = (ci + ri) % 2 === 0;
              const isLM = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const isSel = selectedSquare === sq;
              const isChk = checkedKing === sq;
              const isLegal = legalSet.current.has(sq);
              const hasPc = !!chess.get(sq);

              let hl = '';
              if (isChk) hl = 'rgba(255,0,0,0.4)';
              else if (isLM) hl = 'rgba(255,255,50,0.3)';
              else if (isSel) hl = `${OLIVE} 0.4)`;

              return (
                <div key={idx} onClick={(e) => { e.stopPropagation(); onSquareClick(sq); }}
                  className="relative w-full h-full"
                  style={{ backgroundColor: isLight ? themeColors.light : themeColors.dark }}>
                  {hl && <div className="absolute inset-0" style={{ backgroundColor: hl, zIndex: Z.HIGHLIGHT }} />}

                  {/* Legal indicators — mutually exclusive, never both */}
                  {isLegal && !hasPc && (
                    // Quiet move: small centered dot
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: Z.LEGAL }}>
                      <div style={{
                        width: '24%', height: '24%', borderRadius: '50%',
                        backgroundColor: `${OLIVE} 0.65)`,
                      }} />
                    </div>
                  )}
                  {isLegal && hasPc && (
                    // Capture: ring around the piece only (no dot)
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: Z.LEGAL }}>
                      <div style={{
                        width: '88%', height: '88%', borderRadius: '50%',
                        border: `3px solid ${OLIVE} 0.55)`,
                        boxSizing: 'border-box',
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Snap highlight */}
          <div ref={snapHighlightRef} className="absolute pointer-events-none"
            style={{ zIndex: Z.SNAP, width: '12.5%', height: '12.5%', opacity: 0, backgroundColor: 'rgba(255,255,255,0.13)' }} />

          {/* Pieces — no animation, instant positioning */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: Z.PIECE }}>
            {pieces.map((piece) => {
              const { x, y } = getCoords(piece.square);
              const hidden = dragSource === piece.square;

              return (
                <div key={piece.id}
                  className="absolute pointer-events-auto"
                  style={{
                    width: '12.5%', height: '12.5%',
                    top: `${y * 12.5}%`, left: `${x * 12.5}%`,
                    zIndex: Z.PIECE,
                    opacity: hidden ? 0 : 1,
                    cursor: 'grab',
                  }}
                  onPointerDown={(e) => onPiecePointerDown(e, piece)}>
                  <img src={`./assets/pieces/${piece.color}${piece.type.toUpperCase()}.svg`}
                    alt={`${piece.color}${piece.type}`}
                    className="w-full h-full select-none pointer-events-none" draggable={false} />
                </div>
              );
            })}
          </div>

          {/* Arrows & Highlights */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none fill-none" style={{ zIndex: Z.ARROW }} viewBox="0 0 100 100">
            <defs>
              <marker id="ah" markerWidth="5" markerHeight="5" refX="1.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0.5 L5,2.5 L0,4.5 Q1.5,2.5 0,0.5 Z" fill={`${OLIVE} 0.8)`} />
              </marker>
            </defs>
            {storeCircles.map((c, i) => {
              const co = getCoords(c.square as Square);
              const col = c.color === 'red' ? 'rgba(255,0,0,0.35)' : c.color === 'yellow' ? 'rgba(255,255,0,0.35)' : c.color === 'blue' ? 'rgba(0,100,255,0.35)' : 'rgba(98,113,53,0.35)';
              return <rect key={`sq${i}`} x={co.x * 12.5} y={co.y * 12.5} width="12.5" height="12.5" fill={col} />;
            })}
            {storeArrows.map((a, i) => { const { x1, y1, x2, y2 } = arrowCoords(a); return <line key={`a${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`${OLIVE} 0.8)`} strokeWidth="1.2" strokeLinecap="round" markerEnd="url(#ah)" />; })}
          </svg>

          {/* Promotion */}
          {promotionPending && (() => {
            const color = chess.turn();
            const opts: ('q' | 'r' | 'b' | 'n')[] = ['q', 'r', 'b', 'n'];
            const co = getCoords(promotionPending.to);
            const top = promotionPending.to[1] === '8';
            return (
              <div className="absolute inset-0" style={{ zIndex: Z.PROMO }} onClick={(e) => { e.stopPropagation(); setPromotionPending(null); }}>
                <div className="absolute flex flex-col rounded-md overflow-hidden shadow-xl"
                  style={{ top: top ? `${co.y * 12.5 - 50}%` : `${(co.y + 1) * 12.5}%`, left: `${co.x * 12.5}%`, width: '12.5%', background: '#1a1816', border: '1px solid rgba(255,255,255,0.1)' }}
                  onClick={(e) => e.stopPropagation()}>
                  {opts.map((o) => (
                    <button key={o} onClick={() => { sound.playPromotion(); executeMove(promotionPending.from, promotionPending.to, o); }}
                      className="hover:bg-white/15 cursor-pointer p-1 flex items-center justify-center" style={{ aspectRatio: '1' }}>
                      <img src={`./assets/pieces/${color}${o.toUpperCase()}.svg`} alt={o} className="w-full h-full" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {showCoordinates && (
          <div className="flex flex-col w-5 ml-0.5" style={{ aspectRatio: '1/8' }}>
            {Array.from({ length: 8 }).map((_, i) => {
              const ri = boardOrientation === 'white' ? i : 7 - i;
              return <div key={i} className="flex-1 flex items-center justify-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{RANKS[ri]}</span></div>;
            })}
          </div>
        )}
      </div>

      {showCoordinates && (
        <div className="flex w-full mt-0.5">
          {Array.from({ length: 8 }).map((_, i) => {
            const fi = boardOrientation === 'white' ? i : 7 - i;
            return <div key={i} className="flex-1 text-center"><span className="text-[10px] font-medium select-none" style={{ color: 'rgba(180,180,180,0.5)' }}>{FILES[fi]}</span></div>;
          })}
        </div>
      )}
    </div>
  );
};
