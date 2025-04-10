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
    const boards = await storage.getBoards();
    const board = boards.find((b) => b.id === message.data.boardId);

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "cardDeleted",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find the card to delete
    for (const column of board.columns) {
      if (!column.cards) {
        continue; // Skip columns without cards
      }

      const cardIndex = column.cards.findIndex(
        (c) => c.id === message.data.cardId
      );
      if (cardIndex !== -1) {
        column.cards.splice(cardIndex, 1);
        await storage.saveBoard(board);

        logger.debug(
          `Card with ID ${message.data.cardId} deleted successfully`
        );
        return {
          command: "cardDeleted",
          data: {
            success: true,
            cardId: message.data.cardId,
          },
        };
      }
    }

    logger.error(`Card with ID ${message.data.cardId} not found`);
    return {
      command: "cardDeleted",
      data: {
        success: false,
        error: `Card with ID ${message.data.cardId} not found`,
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
