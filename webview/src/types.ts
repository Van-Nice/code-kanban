import type {
  Board,
  Card,
  Column,
  WebviewColumnData,
  BoardSnapshot,
} from "./shared/types";

// Export types that are used by other files
export type { Board, Card, Column, WebviewColumnData, BoardSnapshot };

// Webview-specific types
export interface VSCodeMessage {
  command: string;
  data?: any;
}
