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
    const boards = await storage.getBoards();
    const board = boards.find((b) => b.id === message.data.boardId);

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "cardUpdated",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find the card to update
    for (const column of board.columns) {
      const cardIndex = column.cards.findIndex(
        (c) => c.id === message.data.card.id
      );
      if (cardIndex !== -1) {
        // Update card properties
        const card = column.cards[cardIndex];
        Object.assign(card, message.data.card);
        card.updatedAt = new Date().toISOString();

        await storage.saveBoard(board);

        logger.debug(
          `Card with ID ${message.data.card.id} updated successfully`
        );
        return {
          command: "cardUpdated",
          data: {
            success: true,
            card,
          },
        };
      }
    }

    logger.error(`Card with ID ${message.data.card.id} not found`);
    return {
      command: "cardUpdated",
      data: {
        success: false,
        error: `Card with ID ${message.data.card.id} not found`,
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
