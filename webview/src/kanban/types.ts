export interface Card {
  id: string;
  title: string;
  description: string;
  labels: string[];
  assignee: string;
  columnId: string;
  boardId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnData {
  id: string;
  title: string;
  cards: Card[];
}

// Store snapshots of the board state for error recovery
export interface BoardSnapshot {
  columns: ColumnData[];
  timestamp: number;
  operation: string;
}

export interface Board {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  columns: Column[];
}

export interface Column {
  id: string;
  title: string;
  cards: Card[];
}