import { MoveCardMessage, CardMovedResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { Card } from "../types";

export async function handleMoveCard(
  message: MoveCardMessage,
  context: HandlerContext
): Promise<CardMovedResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.cardId ||
    !message.data?.fromColumnId ||
    !message.data?.toColumnId
  ) {
    logger.error("Missing required fields for card movement");
    return {
      command: "cardMoved",
      data: {
        success: false,
        error:
          "Missing required fields: boardId, cardId, fromColumnId, or toColumnId",
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
        command: "cardMoved",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find the source column
    const board = boards[boardIndex];
    const fromColumnIndex = board.columns.findIndex(
      (c) => c.id === message.data.fromColumnId
    );

    if (fromColumnIndex === -1) {
      logger.error(
        `Source column with ID ${message.data.fromColumnId} not found in board ${message.data.boardId}`
      );
      return {
        command: "cardMoved",
        data: {
          success: false,
          error: `Source column with ID ${message.data.fromColumnId} not found`,
        },
      };
    }

    // Find the target column
    const toColumnIndex = board.columns.findIndex(
      (c) => c.id === message.data.toColumnId
    );

    if (toColumnIndex === -1) {
      logger.error(
        `Target column with ID ${message.data.toColumnId} not found in board ${message.data.boardId}`
      );
      return {
        command: "cardMoved",
        data: {
          success: false,
          error: `Target column with ID ${message.data.toColumnId} not found`,
        },
      };
    }

    // Find the card to move
    const fromColumn = board.columns[fromColumnIndex];
    const cardIndex = fromColumn.cards.findIndex(
      (c) => c.id === message.data.cardId
    );

    if (cardIndex === -1) {
      logger.error(
        `Card with ID ${message.data.cardId} not found in column ${message.data.fromColumnId}`
      );
      return {
        command: "cardMoved",
        data: {
          success: false,
          error: `Card with ID ${message.data.cardId} not found`,
        },
      };
    }

    // Get the card and remove it from source column
    const card = fromColumn.cards[cardIndex];
    fromColumn.cards.splice(cardIndex, 1);

    // Update card properties for the new column
    const toColumn = board.columns[toColumnIndex];
    const movedCard: Card = {
      ...card,
      columnId: message.data.toColumnId,
      updatedAt: new Date().toISOString(),
    };

    // Add the card to the target column at specified position or at the end
    if (
      typeof message.data.position === "number" &&
      message.data.position >= 0 &&
      message.data.position <= toColumn.cards.length
    ) {
      toColumn.cards.splice(message.data.position, 0, movedCard);
    } else {
      toColumn.cards.push(movedCard);
    }

    // Update the order of cards in the target column
    toColumn.cards.forEach((c, index) => {
      c.order = index;
    });

    // Update the board's timestamp
    board.updatedAt = new Date().toISOString();

    // Save the updated boards
    await storage.saveBoards(boards);

    logger.debug(
      `Card ${message.data.cardId} moved from column ${message.data.fromColumnId} to ${message.data.toColumnId}`
    );
    return {
      command: "cardMoved",
      data: {
        success: true,
        cardId: message.data.cardId,
        fromColumnId: message.data.fromColumnId,
        toColumnId: message.data.toColumnId,
        card: movedCard,
      },
    };
  } catch (error) {
    logger.error("Error moving card:", error);
    return {
      command: "cardMoved",
      data: {
        success: false,
        error: `Failed to move card: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
