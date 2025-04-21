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
  cards: Card[];
  cardIds: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  tags: string[];
  columnId: string;
  boardId: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
