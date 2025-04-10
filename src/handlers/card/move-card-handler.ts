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
    const boards = await storage.getBoards();
    const board = boards.find((b) => b.id === message.data.boardId);

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "cardMoved",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find source and target columns
    const sourceColumn = board.columns.find(
      (c) => c.id === message.data.fromColumnId
    );
    const targetColumn = board.columns.find(
      (c) => c.id === message.data.toColumnId
    );

    if (!sourceColumn || !targetColumn) {
      logger.error("Source or target column not found");
      return {
        command: "cardMoved",
        data: {
          success: false,
          error: "Source or target column not found",
        },
      };
    }

    // Find and remove card from source column
    const cardIndex = sourceColumn.cards.findIndex(
      (c) => c.id === message.data.cardId
    );
    if (cardIndex === -1) {
      logger.error(
        `Card with ID ${message.data.cardId} not found in source column`
      );
      return {
        command: "cardMoved",
        data: {
          success: false,
          error: `Card with ID ${message.data.cardId} not found in source column`,
        },
      };
    }

    const [card] = sourceColumn.cards.splice(cardIndex, 1);
    card.columnId = targetColumn.id;

    // Insert card at target position
    targetColumn.cards.splice(message.data.position ?? 0, 0, card);

    // Update card order
    targetColumn.cards.forEach((c, index) => {
      c.order = index;
    });

    await storage.saveBoard(board);

    logger.debug(
      `Card ${message.data.cardId} moved from column ${message.data.fromColumnId} to ${message.data.toColumnId}`
    );
    return {
      command: "cardMoved",
      data: {
        success: true,
        card,
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
