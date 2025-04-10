import type {
  Board,
  Card,
  Column,
  WebviewColumnData,
  BoardSnapshot,
} from "../shared/types";

// Re-export shared types
export type { Board, Card, Column, WebviewColumnData, BoardSnapshot };

// Kanban-specific types
export interface ColumnData {
  id: string;
  title: string;
  cards: Card[];
}
