import React, { useState } from 'react';
import { MoveNode, Lesson, db } from '../../database/db';
import { useChessStore } from '../../stores/chessStore';
import { sound } from '../../services/soundService';

export const MoveTreeUI: React.FC = () => {
  const activeLesson = useChessStore((s) => s.activeLesson);
  const activeChapterIndex = useChessStore((s) => s.activeChapterIndex);
  const activeNode = useChessStore((s) => s.activeNode);
  const selectNode = useChessStore((s) => s.selectNode);
  const setActiveLesson = useChessStore((s) => s.setActiveLesson);

  const [editingComment, setEditingComment] = useState(false);
  const [commentText, setCommentText] = useState('');

  const chapter = activeLesson?.chapters[activeChapterIndex];

  if (!chapter || chapter.moves.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#12141a]/60 border border-white/5 rounded-2xl h-[300px]">
        <span className="text-3xl mb-2">🎓</span>
        <h4 className="text-sm font-semibold text-gray-300">Move Tree Empty</h4>
        <p className="text-xs text-gray-500 text-center mt-1 max-w-[200px]">
          Make moves on the board in **Editor Mode** to start building your theory!
        </p>
      </div>
    );
  }

  // Update lesson helper
  const updateLessonDb = async (updatedLesson: Lesson) => {
    if (updatedLesson.id) {
      await db.lessons.put(updatedLesson);
      setActiveLesson(updatedLesson, activeChapterIndex);
    }
  };

  // 1. Delete Node
  const handleDeleteNode = () => {
    if (!activeNode || !activeLesson) return;
    sound.playError();

    const deleteFromTree = (list: MoveNode[]): boolean => {
      const idx = list.findIndex((n) => n.id === activeNode.id);
      if (idx !== -1) {
        list.splice(idx, 1);
        return true;
      }
      for (const node of list) {
        if (deleteFromTree(node.children)) return true;
      }
      return false;
    };

    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    const ch = updated.chapters[activeChapterIndex];
    deleteFromTree(ch.moves);
    updateLessonDb(updated);
    selectNode(null);
  };

  // 2. Promote to Main Line
  const handlePromoteNode = () => {
    if (!activeNode || !activeLesson) return;
    sound.playSuccess();

    const promoteInTree = (list: MoveNode[]): boolean => {
      const idx = list.findIndex((n) => n.id === activeNode.id);
      if (idx > 0) {
        // Swap with index 0
        const item = list[idx];
        list.splice(idx, 1);
        list.unshift(item);
        return true;
      }
      for (const node of list) {
        if (promoteInTree(node.children)) return true;
      }
      return false;
    };

    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    const ch = updated.chapters[activeChapterIndex];
    promoteInTree(ch.moves);
    updateLessonDb(updated);
  };

  // 3. Save Comment
  const handleSaveComment = () => {
    if (!activeNode || !activeLesson) return;
    sound.playSuccess();

    const addCommentToTree = (list: MoveNode[]): boolean => {
      const node = list.find((n) => n.id === activeNode.id);
      if (node) {
        node.comment = commentText.trim() || undefined;
        return true;
      }
      for (const n of list) {
        if (addCommentToTree(n.children)) return true;
      }
      return false;
    };

    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    const ch = updated.chapters[activeChapterIndex];
    addCommentToTree(ch.moves);
    updateLessonDb(updated);
    setEditingComment(false);
  };

  const startEditComment = () => {
    setCommentText(activeNode?.comment || '');
    setEditingComment(true);
  };

  // Recursive Move Tree Renderer
  const renderMoveList = (nodes: MoveNode[], showMoveNumber = true): React.ReactNode => {
    return (
      <div className="flex flex-wrap gap-x-1.5 gap-y-1 items-center font-medium">
        {nodes.map((node, index) => {
          const isSelected = activeNode?.id === node.id;
          const fenParts = node.fen.split(' ');
          const moveNumber = parseInt(fenParts[5], 10) - (fenParts[1] === 'w' ? 0 : 1);
          const isWhite = fenParts[1] === 'b';
          const prefix = isWhite
            ? `${moveNumber}. `
            : showMoveNumber || index === 0
              ? `${moveNumber}... `
              : '';

          return (
            <React.Fragment key={node.id}>
              {/* Move Node */}
              <button
                onClick={() => {
                  sound.playHover();
                  selectNode(node);
                }}
                className={`px-1.5 py-0.5 rounded cursor-pointer text-sm font-semibold transition ${
                  isSelected
                    ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/25 scale-[1.03]'
                    : 'text-gray-300 hover:bg-white/5 active:bg-white/10'
                }`}
              >
                {prefix}
                {node.notation}
              </button>

              {/* Comment text inside flow */}
              {node.comment && (
                <span
                  onClick={() => {
                    selectNode(node);
                    startEditComment();
                  }}
                  className="text-xs text-amber-300/80 italic cursor-pointer px-1 py-0.5 rounded hover:bg-amber-400/5 transition max-w-[150px] truncate"
                  title={node.comment}
                >
                  [{node.comment}]
                </span>
              )}

              {/* Alternative Variations */}
              {node.children.slice(1).map((alt) => (
                <span key={alt.id} className="text-gray-400 text-xs flex items-center gap-1 border-l border-white/5 pl-2 my-0.5 bg-black/10 rounded px-1.5 py-0.5">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mr-0.5">Var:</span>
                  {renderMoveList([alt], true)}
                </span>
              ))}

              {/* Next move in current line */}
              {node.children.length > 0 && renderMoveList([node.children[0]], !isWhite)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-[#12141a]/60 border border-white/5 rounded-2xl h-[300px] overflow-hidden">
      {/* Move Tree Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-300">Move Tree</span>
        </div>
        {activeNode && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePromoteNode}
              className="text-[10px] font-bold text-green-400 hover:bg-green-500/10 px-2 py-1 rounded transition cursor-pointer"
              title="Promote this variation to Main Line"
            >
              Promote
            </button>
            <button
              onClick={startEditComment}
              className="text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 px-2 py-1 rounded transition cursor-pointer"
              title="Add Comment to this move"
            >
              Comment
            </button>
            <button
              onClick={handleDeleteNode}
              className="text-[10px] font-bold text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition cursor-pointer"
              title="Delete this move and all children"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Notation Scroll Body */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
        {renderMoveList(chapter.moves)}
      </div>

      {/* Inline Comment Editor Modal */}
      {editingComment && activeNode && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1b1e24] border border-white/10 p-5 rounded-2xl w-full max-w-md shadow-2xl flex flex-col gap-4">
            <h4 className="text-sm font-bold text-gray-200">
              Edit Comment for <span className="text-indigo-400 font-mono">{activeNode.notation}</span>
            </h4>
            <textarea
              className="w-full h-24 bg-[#12141a] text-gray-200 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500 transition resize-none"
              placeholder="Enter positional notes or annotations..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingComment(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveComment}
                className="px-4 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition text-white"
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
