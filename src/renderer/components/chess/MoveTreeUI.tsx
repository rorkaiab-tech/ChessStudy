import React, { useState } from 'react';
import { MoveNode, Lesson, db } from '../../database/db';
import { useChessStore } from '../../stores/chessStore';
import { sound } from '../../services/soundService';
import { Trash2, ArrowUp, MessageSquare } from 'lucide-react';

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
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white/[0.02] border border-white/[0.06] rounded-lg h-[250px]">
        <span className="text-2xl mb-2">🎓</span>
        <h4 className="text-sm font-medium text-l-text-muted">No moves yet</h4>
        <p className="text-xs text-l-text-dim text-center mt-1 max-w-[180px]">
          Use Editor mode to build your move tree.
        </p>
      </div>
    );
  }

  const updateLessonDb = async (updatedLesson: Lesson) => {
    if (updatedLesson.id) {
      await db.lessons.put(updatedLesson);
      setActiveLesson(updatedLesson, activeChapterIndex);
    }
  };

  const handleDeleteNode = () => {
    if (!activeNode || !activeLesson) return;
    sound.playError();
    const deleteFromTree = (list: MoveNode[]): boolean => {
      const idx = list.findIndex((n) => n.id === activeNode.id);
      if (idx !== -1) { list.splice(idx, 1); return true; }
      for (const node of list) { if (deleteFromTree(node.children)) return true; }
      return false;
    };
    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    deleteFromTree(updated.chapters[activeChapterIndex].moves);
    updateLessonDb(updated);
    selectNode(null);
  };

  const handlePromoteNode = () => {
    if (!activeNode || !activeLesson) return;
    sound.playSuccess();
    const promoteInTree = (list: MoveNode[]): boolean => {
      const idx = list.findIndex((n) => n.id === activeNode.id);
      if (idx > 0) { const item = list[idx]; list.splice(idx, 1); list.unshift(item); return true; }
      for (const node of list) { if (promoteInTree(node.children)) return true; }
      return false;
    };
    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    promoteInTree(updated.chapters[activeChapterIndex].moves);
    updateLessonDb(updated);
  };

  const handleSaveComment = () => {
    if (!activeNode || !activeLesson) return;
    sound.playSuccess();
    const addCommentToTree = (list: MoveNode[]): boolean => {
      const node = list.find((n) => n.id === activeNode.id);
      if (node) { node.comment = commentText.trim() || undefined; return true; }
      for (const n of list) { if (addCommentToTree(n.children)) return true; }
      return false;
    };
    const updated = JSON.parse(JSON.stringify(activeLesson)) as Lesson;
    addCommentToTree(updated.chapters[activeChapterIndex].moves);
    updateLessonDb(updated);
    setEditingComment(false);
  };

  const startEditComment = () => {
    setCommentText(activeNode?.comment || '');
    setEditingComment(true);
  };

  const renderMoveList = (nodes: MoveNode[], showMoveNumber = true): React.ReactNode => {
    return (
      <div className="flex flex-wrap gap-x-1 gap-y-0.5 items-center">
        {nodes.map((node, index) => {
          const isSelected = activeNode?.id === node.id;
          const fenParts = node.fen.split(' ');
          const moveNumber = parseInt(fenParts[5], 10) - (fenParts[1] === 'w' ? 0 : 1);
          const isWhite = fenParts[1] === 'b';
          const prefix = isWhite ? `${moveNumber}. ` : showMoveNumber || index === 0 ? `${moveNumber}... ` : '';

          return (
            <React.Fragment key={node.id}>
              <button
                onClick={() => { sound.playHover(); selectNode(node); }}
                className={`px-1 py-0.5 rounded cursor-pointer text-[13px] font-medium transition-colors ${
                  isSelected
                    ? 'bg-l-accent-blue text-white'
                    : 'text-l-text hover:bg-white/[0.06]'
                }`}
              >
                {prefix}{node.notation}
              </button>

              {node.comment && (
                <span
                  onClick={() => { selectNode(node); startEditComment(); }}
                  className="text-[11px] text-l-accent-orange/80 italic cursor-pointer px-1 py-0.5 rounded hover:bg-white/[0.04] transition-colors max-w-[120px] truncate"
                  title={node.comment}
                >
                  [{node.comment}]
                </span>
              )}

              {node.children.slice(1).map((alt) => (
                <span key={alt.id} className="text-l-text-dim text-[11px] flex items-center gap-1 border-l border-white/[0.06] pl-2 my-0.5 bg-white/[0.02] rounded px-1.5 py-0.5">
                  <span className="text-[9px] text-l-text-dim font-semibold uppercase tracking-wider mr-0.5">Var:</span>
                  {renderMoveList([alt], true)}
                </span>
              ))}

              {node.children.length > 0 && renderMoveList([node.children[0]], !isWhite)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-white/[0.02] border border-white/[0.06] rounded-lg h-[250px] overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 bg-white/[0.02] border-b border-white/[0.06]">
        <span className="text-xs font-semibold text-l-text-muted">Move Tree</span>
        {activeNode && (
          <div className="flex items-center gap-1">
            <button onClick={handlePromoteNode} className="text-[10px] font-medium text-green-400 hover:bg-green-500/10 px-1.5 py-0.5 rounded transition-colors cursor-pointer" title="Promote to main line">
              <ArrowUp size={12} />
            </button>
            <button onClick={startEditComment} className="text-[10px] font-medium text-l-accent-orange hover:bg-orange-500/10 px-1.5 py-0.5 rounded transition-colors cursor-pointer" title="Add comment">
              <MessageSquare size={12} />
            </button>
            <button onClick={handleDeleteNode} className="text-[10px] font-medium text-red-400 hover:bg-red-500/10 px-1.5 py-0.5 rounded transition-colors cursor-pointer" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3">
        {renderMoveList(chapter.moves)}
      </div>

      {editingComment && activeNode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-l-bg-light border border-white/10 p-5 rounded-lg w-full max-w-md shadow-xl flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-white">
              Comment for <span className="text-l-accent-blue font-mono">{activeNode.notation}</span>
            </h4>
            <textarea
              className="w-full h-20 bg-l-bg text-l-text border border-white/[0.06] rounded-md p-3 text-sm focus:outline-none focus:border-l-accent-blue/50 transition-colors resize-none"
              placeholder="Notes..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingComment(false)} className="px-3 py-1.5 text-xs text-l-text-dim hover:text-l-text font-medium cursor-pointer">Cancel</button>
              <button onClick={handleSaveComment} className="px-3 py-1.5 text-xs bg-l-accent-blue rounded-md font-medium text-white cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
