import { DeleteCardMessage, CardDeletedResponse } from "../messages";
import { HandlerContext } from "../message-handler";

export async function handleDeleteCard(
  message: DeleteCardMessage,
  context: HandlerContext
): Promise<CardDeletedResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.columnId ||
    !message.data?.cardId
  ) {
    logger.error("Missing required fields for card deletion");
    return {
      command: "cardDeleted",
      data: {
        success: false,
        error: "Missing required fields: boardId, columnId, or cardId",
      },
    };
  }

  try {
    // Get boards and find the target board
    const boards = storage.getBoards();
    const boardIndex = boards.findIndex((b) => b.id === message.data.boardId);

    if (boardIndex === -1) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "cardDeleted",
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
        command: "cardDeleted",
        data: {
          success: false,
          error: `Column with ID ${message.data.columnId} not found`,
        },
      };
    }

    // Find the card to delete
    const column = board.columns[columnIndex];
    const cardIndex = column.cards.findIndex(
      (c) => c.id === message.data.cardId
    );

    if (cardIndex === -1) {
      logger.error(
        `Card with ID ${message.data.cardId} not found in column ${message.data.columnId}`
      );
      return {
        command: "cardDeleted",
        data: {
          success: false,
          error: `Card with ID ${message.data.cardId} not found`,
        },
      };
    }

    // Remove the card
    column.cards.splice(cardIndex, 1);

    // Update the board's timestamp
    board.updatedAt = new Date().toISOString();

    // Save the updated boards
    await storage.saveBoards(boards);

    logger.debug(
      `Card ${message.data.cardId} deleted from column ${message.data.columnId}`
    );
    return {
      command: "cardDeleted",
      data: {
        success: true,
        cardId: message.data.cardId,
        columnId: message.data.columnId,
      },
    };
  } catch (error) {
    logger.error("Error deleting card:", error);
    return {
      command: "cardDeleted",
      data: {
        success: false,
        error: `Failed to delete card: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
