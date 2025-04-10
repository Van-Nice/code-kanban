import { AddCardMessage, CardResponse } from "./messages";
import { HandlerContext } from "./message-handler";
import { Card } from "./types";
import { sanitizeString } from "./utils";

export async function handleAddCard(
  message: AddCardMessage,
  context: HandlerContext
): Promise<CardResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.columnId ||
    !message.data?.card
  ) {
    logger.error("Missing required fields for card addition");
    return {
      command: "cardAdded",
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
      createdAt: message.data.card.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Get boards and find the target board
    const boards = storage.getBoards();
    const boardIndex = boards.findIndex((b) => b.id === message.data.boardId);

    if (boardIndex === -1) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "cardAdded",
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
        command: "cardAdded",
        data: {
          success: false,
          error: `Column with ID ${message.data.columnId} not found`,
        },
      };
    }

    // Add card to column
    const column = board.columns[columnIndex];

    // Set the order if not provided
    if (sanitizedCard.order === undefined) {
      sanitizedCard.order = column.cards.length;
    }

    column.cards.push(sanitizedCard);

    // Update the board's timestamp
    board.updatedAt = new Date().toISOString();

    // Save the updated boards
    await storage.saveBoards(boards);

    logger.debug(
      `Card ${sanitizedCard.id} added to column ${message.data.columnId}`
    );
    return {
      command: "cardAdded",
      data: {
        success: true,
        card: sanitizedCard,
        columnId: message.data.columnId,
      },
    };
  } catch (error) {
    logger.error("Error adding card:", error);
    return {
      command: "cardAdded",
      data: {
        success: false,
        error: `Failed to add card: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
