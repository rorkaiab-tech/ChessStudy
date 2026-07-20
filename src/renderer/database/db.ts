import Dexie, { Table } from 'dexie';

export interface Lesson { id?: number; name: string; category: string; difficulty: string; content: string; }
export class StudyDB extends Dexie {
  lessons!: Table<Lesson>;
  constructor() { super('ChessStudy'); this.version(1).stores({ lessons: '++id,name,category,difficulty' }); }
}
export const db = new StudyDB();
