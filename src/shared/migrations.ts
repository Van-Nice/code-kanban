import {
  StorageData,
  Migration,
  MigrationFunction,
  CURRENT_STORAGE_VERSION,
} from "./types";

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
          labels: card.labels || [],
          assignee: card.assignee || "",
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
