import React from 'react';
import { motion } from 'framer-motion';

export const ChessBoard: React.FC = () => (
  <div className="relative w-full max-w-[700px] aspect-square bg-gradient-to-br from-[#769656] to-[#eeeed2] rounded-2xl shadow-2xl overflow-hidden">
    <svg viewBox="0 0 8 8" className="w-full h-full">
      {Array.from({ length: 64 }).map((_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);
        const isLight = (x + y) % 2 === 0;
        return (
          <rect key={i} x={x} y={y} width={1} height={1} fill={isLight ? '#eeeed2' : '#769656'} />
        );
      })}
    </svg>
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute top-[3.5rem] left-[2.5rem] text-7xl text-amber-900 drop-shadow-lg"
    >
      ♘
    </motion.div>
    <div className="absolute bottom-2 left-2 text-xs text-amber-900/60 font-mono">Chess Construction</div>
  </div>
);
