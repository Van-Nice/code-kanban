// Base types
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Card types
export interface Card extends BaseEntity {
  id: string;
  title: string;
  description: string;
  tags: string[];
  columnId: string;
  boardId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardData extends BaseEntity {
  title: string;
  description: string;
  tags: string[];
  columnId: string;
  boardId: string;
  order: number;
}

// Column types
export interface ColumnData extends BaseEntity {
  id: string;
  title: string;
  boardId: string;
  cardIds: string[]; // For storage
  order: number;
}

export interface Column {
  id: string;
  title: string;
  boardId: string;
  cards: Card[];
  cardIds: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
  collapsed?: boolean;
}

// Board types
export interface BoardMetadata extends BaseEntity {
  id: string;
  title: string;
  description: string;
  columnIds: string[];
}

export interface Board extends BaseEntity {
  id: string;
  title: string;
  description: string;
  columns: Column[];
}

// Storage types
export interface StorageData {
  boards: Map<string, BoardMetadata>;
  columns: Map<string, ColumnData>;
  cards: Map<string, CardData>;
}

// Type guards
export function isBoardMetadata(data: any): data is BoardMetadata {
  return (
    typeof data.id === "string" &&
    typeof data.title === "string" &&
    typeof data.description === "string" &&
    typeof data.createdAt === "string" &&
    typeof data.updatedAt === "string" &&
    Array.isArray(data.columnIds)
  );
}

export function isColumnData(data: any): data is ColumnData {
  return (
    typeof data.id === "string" &&
    typeof data.title === "string" &&
    typeof data.boardId === "string" &&
    typeof data.order === "number" &&
    Array.isArray(data.cardIds)
  );
}

export function isCardData(data: any): data is CardData {
  return (
    typeof data.id === "string" &&
    typeof data.title === "string" &&
    typeof data.description === "string" &&
    typeof data.columnId === "string" &&
    typeof data.boardId === "string" &&
    typeof data.order === "number" &&
    Array.isArray(data.tags) &&
    typeof data.createdAt === "string" &&
    typeof data.updatedAt === "string"
  );
}

// Migration types
export type MigrationFunction = (data: any) => Promise<StorageData>;

export interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: MigrationFunction;
}

// Storage version constants
export const STORAGE_KEYS = {
  BOARDS: "codeKanban.boards.metadata",
  COLUMNS: "codeKanban.boards.columns",
  CARDS: "codeKanban.boards.cards",
  VERSION: "codeKanban.storage.version",
} as const;

export const CURRENT_STORAGE_VERSION = "1.1.0";
