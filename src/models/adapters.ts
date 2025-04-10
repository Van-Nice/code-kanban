import {
  Board as SharedBoard,
  Column as SharedColumn,
  Card as SharedCard,
  BoardMetadata,
} from "../shared/types";
import { Board, Column, Card } from "./board";

/**
 * Adapters to convert between different model representations
 */

// Convert from storage model to API model
export function convertToApiBoard(board: SharedBoard): Board {
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    columnIds: board.columns.map((c) => c.id),
    columns: [], // Add empty columns array
    createdAt: new Date(board.createdAt),
    updatedAt: new Date(board.updatedAt),
  };
}

export function convertToApiColumn(column: SharedColumn): Column {
  return {
    id: column.id,
    title: column.title,
    boardId: column.cards[0]?.boardId || "", // Use first card's boardId or empty string
    cardIds: column.cards.map((c) => c.id),
    createdAt: new Date(column.createdAt),
    updatedAt: new Date(column.updatedAt),
  };
}

export function convertToApiCard(card: SharedCard): Card {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    columnId: card.columnId,
    boardId: card.boardId,
    createdAt: new Date(card.createdAt),
    updatedAt: new Date(card.updatedAt),
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
    cards: cards,
    order: 0, // Default order
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
  };
}

export function convertToStorageCard(card: Card): SharedCard {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    columnId: card.columnId,
    boardId: card.boardId,
    labels: [],
    assignee: "",
    order: 0, // Default order
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
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
