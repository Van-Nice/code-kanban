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
    boardId: column.boardId || column.cards[0]?.boardId || "", // Use column's boardId first, then fallback to first card's boardId
    cards: column.cards.map(convertToApiCard),
    cardIds: column.cards.map((c) => c.id),
    order: column.order || 0,
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
    tags: card.tags || [],
    order: card.order || 0,
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
