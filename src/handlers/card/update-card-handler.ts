import { UpdateCardMessage, CardResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { Card } from "../types";
import { sanitizeString } from "../utils";

export async function handleUpdateCard(
  message: UpdateCardMessage,
  context: HandlerContext
): Promise<CardResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.columnId ||
    !message.data?.card
  ) {
    logger.error("Missing required fields for card update");
    return {
      command: "cardUpdated",
      data: {
        success: false,
        error: "Missing required fields: boardId, columnId, or card data",
      },
    };
  }

  try {
    // Sanitize card data
    const sanitizedCard: Card = {
      ...message.data.card,
      title: sanitizeString(message.data.card.title, 100),
      description: sanitizeString(message.data.card.description || "", 1000),
      labels: Array.isArray(message.data.card.labels)
        ? message.data.card.labels
            .slice(0, 10)
            .map((label) => sanitizeString(label, 50))
        : [],
      assignee: sanitizeString(message.data.card.assignee || "", 100),
      boardId: message.data.boardId,
      columnId: message.data.columnId,
      updatedAt: new Date().toISOString(),
    };

    // Get boards and find the target board
    const boards = storage.getBoards();
    const boardIndex = boards.findIndex((b) => b.id === message.data.boardId);

    if (boardIndex === -1) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "cardUpdated",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find the target column
    const board = boards[boardIndex];
    const columnIndex = board.columns.findIndex(
      (c) => c.id === message.data.columnId
    );

    if (columnIndex === -1) {
      logger.error(
        `Column with ID ${message.data.columnId} not found in board ${message.data.boardId}`
      );
      return {
        command: "cardUpdated",
        data: {
          success: false,
          error: `Column with ID ${message.data.columnId} not found`,
        },
      };
    }

    // Find the card to update
    const column = board.columns[columnIndex];
    const cardIndex = column.cards.findIndex(
      (c) => c.id === message.data.card.id
    );

    if (cardIndex === -1) {
      logger.error(
        `Card with ID ${message.data.card.id} not found in column ${message.data.columnId}`
      );
      return {
        command: "cardUpdated",
        data: {
          success: false,
          error: `Card with ID ${message.data.card.id} not found`,
        },
      };
    }

    // Update the card
    column.cards[cardIndex] = sanitizedCard;

    // Update the board's timestamp
    board.updatedAt = new Date().toISOString();

    // Save the updated boards
    await storage.saveBoards(boards);

    logger.debug(
      `Card ${sanitizedCard.id} updated in column ${message.data.columnId}`
    );
    return {
      command: "cardUpdated",
      data: {
        success: true,
        card: sanitizedCard,
        columnId: message.data.columnId,
      },
    };
  } catch (error) {
    logger.error("Error updating card:", error);
    return {
      command: "cardUpdated",
      data: {
        success: false,
        error: `Failed to update card: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
