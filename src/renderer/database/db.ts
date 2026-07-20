import Dexie, { Table } from 'dexie';

export interface MoveNode {
  id: string;
  notation: string;
  from: string;
  to: string;
  fen: string;
  comment?: string;
  arrows?: Array<{ from: string; to: string; color: string }>;
  circles?: Array<{ square: string; color: string }>;
  children: MoveNode[];
}

export interface Chapter {
  id: string;
  name: string;
  fen: string; // Starting FEN of this chapter
  moves: MoveNode[]; // Root-level move nodes of the tree
}

export interface Lesson {
  id?: number;
  name: string;
  category: string; // 'Openings' | 'Traps' | 'Middlegame' | 'Endgames' | 'Lessons'
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  chapters: Chapter[];
  isFavorite: number; // 0 or 1 for indexing
  tags: string[];
  createdAt: number;
}

export interface LessonProgress {
  lessonId: number;
  lastStudiedAt: number;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  dueDate: number; // Timestamp
  masteryState: 'new' | 'learning' | 'reviewing' | 'mastered';
}

export interface StudyHistory {
  id?: number;
  date: string; // YYYY-MM-DD
  movesPlayed: number;
  correctMoves: number;
}

export class ChessStudyDB extends Dexie {
  lessons!: Table<Lesson>;
  progress!: Table<LessonProgress>;
  history!: Table<StudyHistory>;

  constructor() {
    super('ChessStudyDatabase');
    this.version(2).stores({
      lessons: '++id,name,category,difficulty,isFavorite,*tags,createdAt',
      progress: 'lessonId,dueDate,masteryState',
      history: '++id,date',
    });
  }
}

export const db = new ChessStudyDB();
