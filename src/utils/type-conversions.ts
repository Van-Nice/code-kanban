import {
  Board as SharedBoard,
  Column as SharedColumn,
  Card as SharedCard,
  BoardMetadata,
} from "../shared/types";
import {
  Board as ModelBoard,
  Column as ModelColumn,
  Card as ModelCard,
} from "../models/board";
import {
  Board as HandlerBoard,
  Column as HandlerColumn,
  Card as HandlerCard,
} from "../handlers/board/board";

/**
 * Converts a Board from handler type to model type.
 * Handles optional description and other properties.
 */
export function convertToModelBoard(
  board: HandlerBoard | SharedBoard
): ModelBoard {
  return {
    id: board.id,
    title: board.title,
    description: board.description || "", // Handle potentially undefined description
    columns: Array.isArray(board.columns)
      ? board.columns.map((col) => convertToModelColumn(col, board.id))
      : [],
    columnIds:
      "columnIds" in board && Array.isArray(board.columnIds)
        ? board.columnIds
        : undefined,
    createdAt:
      typeof board.createdAt === "string"
        ? new Date(board.createdAt)
        : board.createdAt,
    updatedAt:
      typeof board.updatedAt === "string"
        ? new Date(board.updatedAt)
        : board.updatedAt,
  };
}

/**
 * Converts a Column from handler type to model type.
 * Adds required properties like boardId and cardIds.
 */
export function convertToModelColumn(
  column: HandlerColumn | SharedColumn,
  boardId: string
): ModelColumn {
  return {
    id: column.id,
    title: column.title,
    boardId: boardId,
    cards: Array.isArray(column.cards)
      ? column.cards.map((card) => convertToModelCard(card, boardId))
      : [],
    cardIds: Array.isArray(column.cards)
      ? column.cards.map((card) => card.id)
      : [],
    order: column.order || 0,
    createdAt:
      typeof column.createdAt === "string"
        ? new Date(column.createdAt)
        : column.createdAt,
    updatedAt:
      typeof column.updatedAt === "string"
        ? new Date(column.updatedAt)
        : column.updatedAt,
  };
}

/**
 * Converts a Card from handler type to model type.
 * Handles conversion of date strings to Date objects.
 */
export function convertToModelCard(
  card: HandlerCard | SharedCard,
  boardId?: string
): ModelCard {
  // Get boardId from the card if it exists, otherwise use provided boardId
  const cardBoardId = "boardId" in card ? card.boardId : boardId || "";

  return {
    id: card.id,
    title: card.title,
    description: card.description || "", // Handle potentially undefined description
    columnId: card.columnId,
    boardId: cardBoardId,
    tags: (card as any).tags || [],
    order: (card as any).order || 0,
    createdAt:
      typeof card.createdAt === "string"
        ? new Date(card.createdAt)
        : card.createdAt,
    updatedAt:
      typeof card.updatedAt === "string"
        ? new Date(card.updatedAt)
        : card.updatedAt,
  };
}

/**
 * Converts a model Board back to shared type format.
 * This is useful when data needs to be sent to the UI.
 */
export function convertToSharedBoard(board: ModelBoard): SharedBoard {
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    columns: board.columns.map(convertToSharedColumn),
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

/**
 * Converts a model Column to shared type format.
 */
export function convertToSharedColumn(column: ModelColumn): SharedColumn {
  return {
    id: column.id,
    title: column.title,
    boardId: column.boardId,
    cards: column.cards.map(convertToSharedCard),
    cardIds: column.cardIds,
    order: column.order,
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
  };
}

/**
 * Converts a model Card to shared type format.
 */
export function convertToSharedCard(card: ModelCard): SharedCard {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    tags: card.tags,
    columnId: card.columnId,
    boardId: card.boardId,
    order: card.order,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

/**
 * Converts BoardMetadata to a Board model
 */
export function adaptBoardMetadataToBoard(metadata: BoardMetadata): ModelBoard {
  return {
    id: metadata.id,
    title: metadata.title,
    description: metadata.description,
    columnIds: metadata.columnIds,
    columns: [], // Add empty columns array
    createdAt:
      typeof metadata.createdAt === "string"
        ? new Date(metadata.createdAt)
        : metadata.createdAt,
    updatedAt:
      typeof metadata.updatedAt === "string"
        ? new Date(metadata.updatedAt)
        : metadata.updatedAt,
  };
}
