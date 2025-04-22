import { BoardMetadata, ColumnData, CardData } from "../types";

export type { BoardMetadata, ColumnData, CardData };

export const STORAGE_KEYS = {
  BOARDS: "codeKanban.boards.metadata",
  COLUMNS: "codeKanban.boards.columns",
  CARDS: "codeKanban.boards.cards",
  VERSION: "codeKanban.storage.version",
} as const;

export const CURRENT_STORAGE_VERSION = "1.0.0";

export interface StorageData {
  boards: Map<string, BoardMetadata>;
  columns: Map<string, ColumnData>;
  cards: Map<string, CardData>;
}
