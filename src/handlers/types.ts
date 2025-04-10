import {
  Board,
  Card,
  Column,
  BoardMetadata,
  ColumnData,
  CardData,
} from "../shared/types";

// Re-export shared types
export { Board, Card, Column, BoardMetadata, ColumnData, CardData };

// Handler-specific types
export interface HandlerError {
  message: string;
  code?: string;
  details?: any;
}

export interface HandlerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: HandlerError;
}
