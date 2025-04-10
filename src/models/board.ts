/**
 * Core model interfaces for Boards, Columns, and Cards
 */
export interface Board {
  id: string;
  title: string;
  description: string;
  columns: Column[];
  columnIds?: string[]; // For compatibility with some handlers
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: string;
  title: string;
  boardId: string;
  cards?: Card[]; // For UI representation
  cardIds: string[]; // For storage representation
  createdAt: Date;
  updatedAt: Date;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  columnId: string;
  boardId: string;
  createdAt: Date;
  updatedAt: Date;
}
