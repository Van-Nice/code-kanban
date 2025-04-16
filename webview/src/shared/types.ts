// Base types
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Card types
export interface Card extends BaseEntity {
  title: string;
  description: string;
  labels: string[];
  assignee: string;
  columnId: string;
  boardId: string;
  order: number;
}

// Column types
export interface Column extends BaseEntity {
  id: string;
  title: string;
  cards: Card[];
  order: number;
  collapsed?: boolean;
}

// Board types
export interface Board extends BaseEntity {
  id: string;
  title: string;
  description: string;
  columns: Column[];
}

// Webview-specific types
export interface WebviewColumnData {
  id: string;
  title: string;
  cards: Card[];
  order: number;
}

export interface BoardSnapshot {
  columns: WebviewColumnData[];
  timestamp: number;
  operation: string;
}

export interface VSCodeMessage {
  command: string;
  data?: any;
}
