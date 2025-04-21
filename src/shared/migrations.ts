import {
  StorageData,
  Migration,
  MigrationFunction,
  CURRENT_STORAGE_VERSION,
} from "./types";

// Migration for the old format used in tests
// This handles the legacy format where boards were stored as an object
const migrateFromLegacyFormat = async (data: any): Promise<StorageData> => {
  const result: StorageData = {
    boards: new Map(),
    columns: new Map(),
    cards: new Map(),
  };

  // Check if this is the old format with {version, boards: {}} structure
  if (
    data &&
    data.boards &&
    typeof data.boards === "object" &&
    !Array.isArray(data.boards)
  ) {
    const oldBoards = data.boards;

    // Process each board
    Object.entries(oldBoards).forEach(([id, boardData]) => {
      const board = boardData as any;

      // Create board in the new format
      result.boards.set(id, {
        id: board.id || id,
        title: board.title || "Untitled Board",
        description: board.description || "",
        columnIds: [],
        createdAt: board.createdAt || new Date().toISOString(),
        updatedAt: board.updatedAt || new Date().toISOString(),
      });

      // Process columns if any
      if (board.columns && Array.isArray(board.columns)) {
        board.columns.forEach((oldColumn: any) => {
          const columnId = oldColumn.id;

          // Add column ID to board's columnIds
          const existingBoard = result.boards.get(id);
          if (existingBoard) {
            existingBoard.columnIds.push(columnId);
            result.boards.set(id, existingBoard);
          }

          // Create column in the new format
          result.columns.set(columnId, {
            id: columnId,
            title: oldColumn.title || "Untitled Column",
            boardId: id,
            cardIds: [],
            order: oldColumn.order || 0,
            createdAt: oldColumn.createdAt || new Date().toISOString(),
            updatedAt: oldColumn.updatedAt || new Date().toISOString(),
          });

          // Process cards if any
          if (oldColumn.cards && Array.isArray(oldColumn.cards)) {
            oldColumn.cards.forEach((oldCard: any) => {
              const cardId = oldCard.id;

              // Add card ID to column's cardIds
              const existingColumn = result.columns.get(columnId);
              if (existingColumn) {
                existingColumn.cardIds.push(cardId);
                result.columns.set(columnId, existingColumn);
              }

              // Create card in the new format
              result.cards.set(cardId, {
                id: cardId,
                title: oldCard.title || "Untitled Card",
                description: oldCard.description || "",
                columnId: columnId,
                boardId: id,
                tags: oldCard.labels || oldCard.tags || [],
                order: oldCard.order || 0,
                createdAt: oldCard.createdAt || new Date().toISOString(),
                updatedAt: oldCard.updatedAt || new Date().toISOString(),
              });
            });
          }
        });
      }
    });

    return result;
  }

  // If it's not the legacy format, continue with regular migration
  return migrateTo110(data);
};

// Migration from 1.0.0 to 1.1.0
// Added required order field to cards and columns
const migrateTo110: MigrationFunction = async (
  data: any
): Promise<StorageData> => {
  const result: StorageData = {
    boards: new Map(),
    columns: new Map(),
    cards: new Map(),
  };

  // Check for the old format first and handle it specially
  if (
    data &&
    data.boards &&
    typeof data.boards === "object" &&
    !Array.isArray(data.boards)
  ) {
    return migrateFromLegacyFormat(data);
  }

  // Migrate boards
  if (Array.isArray(data.boards)) {
    data.boards.forEach((board: any) => {
      if (board.id && board.title) {
        result.boards.set(board.id, {
          id: board.id,
          title: board.title,
          description: board.description || "",
          createdAt: board.createdAt || new Date().toISOString(),
          updatedAt: board.updatedAt || new Date().toISOString(),
          columnIds: board.columnIds || [],
        });
      }
    });
  }

  // Migrate columns
  if (Array.isArray(data.columns)) {
    data.columns.forEach((column: any) => {
      if (column.id && column.title && column.boardId) {
        result.columns.set(column.id, {
          id: column.id,
          title: column.title,
          boardId: column.boardId,
          cardIds: column.cardIds || [],
          order: column.order || 0,
          createdAt: column.createdAt || new Date().toISOString(),
          updatedAt: column.updatedAt || new Date().toISOString(),
        });
      }
    });
  }

  // Migrate cards
  if (Array.isArray(data.cards)) {
    data.cards.forEach((card: any) => {
      if (card.id && card.title && card.columnId && card.boardId) {
        result.cards.set(card.id, {
          id: card.id,
          title: card.title,
          description: card.description || "",
          tags: card.labels || card.tags || [],
          columnId: card.columnId,
          boardId: card.boardId,
          order: card.order || 0,
          createdAt: card.createdAt || new Date().toISOString(),
          updatedAt: card.updatedAt || new Date().toISOString(),
        });
      }
    });
  }

  return result;
};

export const MIGRATIONS: Migration[] = [
  {
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    migrate: migrateTo110,
  },
];

export async function migrateData(
  version: string,
  data: any
): Promise<StorageData> {
  let currentData = data;
  let currentVersion = version;

  // Find and apply all applicable migrations
  for (const migration of MIGRATIONS) {
    if (currentVersion === migration.fromVersion) {
      currentData = await migration.migrate(currentData);
      currentVersion = migration.toVersion;
    }
  }

  if (currentVersion !== CURRENT_STORAGE_VERSION) {
    throw new Error(
      `Failed to migrate to current version ${CURRENT_STORAGE_VERSION}. Last version: ${currentVersion}`
    );
  }

  return currentData as StorageData;
}
