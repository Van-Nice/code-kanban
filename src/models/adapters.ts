import type {
  Board as SharedBoard,
  Column as SharedColumn,
  Card as SharedCard,
} from "../shared/types";
import type {
  Board as ModelBoard,
  Column as ModelColumn,
  Card as ModelCard,
} from "./board";

/**
 * Adapters to convert between different model representations
 */

// Convert from storage model to API model
export function convertToApiBoard(board: ModelBoard): SharedBoard {
  return {
    ...board,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    columns: board.columns.map(convertToApiColumn),
  };
}

function convertToApiColumn(column: ModelColumn): SharedColumn {
  return {
    ...column,
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
    cards: column.cards.map(convertToApiCard),
  };
}

function convertToApiCard(card: ModelCard): SharedCard {
  return {
    ...card,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

// Convert from API model to storage model
export function convertToStorageBoard(board: Board): SharedBoard {
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    columns: [], // Empty array to be filled in by caller
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

export function convertToStorageColumn(
  column: Column,
  cards: SharedCard[] = []
): SharedColumn {
  return {
    id: column.id,
    title: column.title,
    boardId: column.boardId,
    cards: cards,
    cardIds: column.cardIds,
    order: column.order || 0,
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
  };
}

export function convertToStorageCard(card: Card): SharedCard {
  const cardData: CardData = {
    id: card.id,
    title: card.title,
    description: card.description || "",
    tags: card.tags || [],
    columnId: card.columnId,
    boardId: card.boardId,
    order: 0, // Default order
    createdAt: new Date().toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
  return cardData;
}

// Add the missing columns property
export function adaptBoardMetadataToBoard(metadata: BoardMetadata): Board {
  return {
    id: metadata.id,
    title: metadata.title,
    description: metadata.description,
    columnIds: metadata.columnIds,
    columns: [], // Add empty columns array
    createdAt:
      typeof metadata.createdAt === "string"
        ? new Date(metadata.createdAt)
        : new Date(),
    updatedAt:
      typeof metadata.updatedAt === "string"
        ? new Date(metadata.updatedAt)
        : new Date(),
  };
}
