import { Board, Card, Column } from "./board";

export interface Storage {
  // Board operations
  saveBoard(board: Board): Promise<void>;
  getBoard(id: string): Promise<Board | null>;
  getBoards(): Promise<Board[]>;
  deleteBoard(id: string): Promise<void>;

  // Column operations
  saveColumn(column: Column): Promise<void>;
  getColumn(id: string): Promise<Column | null>;
  getColumns(boardId: string): Promise<Column[]>;
  deleteColumn(id: string): Promise<void>;

  // Card operations
  saveCard(card: Card): Promise<void>;
  getCard(id: string): Promise<Card | null>;
  getCards(columnId: string): Promise<Card[]>;
  deleteCard(id: string): Promise<void>;
  moveCard(
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    position: number
  ): Promise<void>;

  // Data management
  clear(): Promise<void>;
  load(): Promise<void>;
  save(): Promise<void>;
}
