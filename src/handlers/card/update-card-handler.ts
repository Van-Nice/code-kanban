import { UpdateCardMessage, CardResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import {
  Board as HandlerBoard,
  Card as HandlerCard,
  Column as HandlerColumn,
} from "../board/board";
import { Board as ModelBoard, Card as ModelCard } from "../../models/board";
import { sanitizeString } from "../utils";
import { convertToModelCard } from "../../utils/type-conversions";

export async function handleUpdateCard(
  message: UpdateCardMessage,
  context: HandlerContext
): Promise<CardResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.columnId ||
    !message.data?.cardId ||
    !message.data?.title
  ) {
    logger.error("Missing required fields for card update");
    return {
      command: "cardUpdated",
      data: {
        success: false,
        error: "Missing required fields: boardId, columnId, cardId, or title",
      },
    };
  }

  try {
    const boards = await storage.getBoards();
    const board = boards.find(
      (b) => b.id === message.data.boardId
    ) as unknown as HandlerBoard;

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
      if (!column.cards) {
        column.cards = [];
        continue;
      }

      const cardIndex = column.cards.findIndex(
        (c) => c.id === message.data.cardId
      );

      if (cardIndex !== -1) {
        // Update card properties
        const card = column.cards[cardIndex];

        // Update the card with the new values
        card.title = sanitizeString(message.data.title, 100);
        card.description = sanitizeString(message.data.description, 1000);
        card.updatedAt = new Date().toISOString(); // Convert to string for handler type

        // Convert to ModelBoard before saving
        const modelBoard: ModelBoard = {
          ...board,
          description: board.description || "",
          columns: board.columns.map((col) => ({
            id: col.id,
            title: col.title,
            boardId: board.id,
            cards: col.cards?.map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description || "",
              columnId: c.columnId,
              boardId: board.id,
              createdAt: new Date(c.createdAt),
              updatedAt: new Date(c.updatedAt),
            })),
            cardIds: col.cards?.map((c) => c.id) || [],
            createdAt: new Date(col.createdAt),
            updatedAt: new Date(col.updatedAt),
          })),
          createdAt: new Date(board.createdAt),
          updatedAt: new Date(board.updatedAt),
        };

        await storage.saveBoard(modelBoard);

        logger.debug(
          `Card with ID ${message.data.cardId} updated successfully`
        );

        // Create a ModelCard for the response
        const responseCard: ModelCard = {
          id: card.id,
          title: card.title,
          description: card.description || "",
          columnId: card.columnId,
          boardId: message.data.boardId,
          createdAt: new Date(card.createdAt),
          updatedAt: new Date(card.updatedAt),
        };

        return {
          command: "cardUpdated",
          data: {
            success: true,
            card: responseCard,
          },
        };
      }
    }

    logger.error(`Card with ID ${message.data.cardId} not found`);
    return {
      command: "cardUpdated",
      data: {
        success: false,
        error: `Card with ID ${message.data.cardId} not found`,
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
