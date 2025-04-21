import {
  UpdateCardMessage,
  CardResponse,
  CardUpdatedResponse,
} from "../messages";
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
): Promise<CardUpdatedResponse> {
  const { storage, logger } = context;

  // ADDED: Log entry and received data
  logger.debug(
    "[handleUpdateCard] Handler invoked. Received data:",
    message.data
  );

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
        boardId: message.data?.boardId || "",
        columnId: message.data?.columnId || "",
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
          boardId: message.data.boardId,
          columnId: message.data.columnId,
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
        const originalCardDataForLog = { ...card }; // Log original state

        // Update the card with the new values from the message
        let updated = false;
        if (message.data.title && card.title !== message.data.title) {
          card.title = sanitizeString(message.data.title, 100);
          updated = true;
        }
        if (
          message.data.description !== undefined &&
          card.description !== message.data.description
        ) {
          card.description = sanitizeString(message.data.description, 1000);
          updated = true;
        }
        if (
          message.data.tags !== undefined &&
          JSON.stringify(card.tags) !== JSON.stringify(message.data.tags)
        ) {
          // Ensure tags is always an array
          card.tags = Array.isArray(message.data.tags)
            ? message.data.tags.map((tag) => sanitizeString(tag, 50))
            : [];
          updated = true;
        }
        if (
          message.data.order !== undefined &&
          card.order !== message.data.order
        ) {
          card.order = message.data.order;
          updated = true;
        }

        if (updated) {
          card.updatedAt = new Date().toISOString();
          logger.debug("[handleUpdateCard] Updated card fields:", {
            id: card.id,
            title: card.title,
            description: card.description,
            tags: card.tags,
            order: card.order,
          });
        } else {
          logger.debug(
            "[handleUpdateCard] No fields changed for card:",
            card.id
          );
          // Optionally return early if nothing changed?
          // For now, we still save to update the board's general updatedAt potentially.
        }

        // Convert to ModelBoard before saving - NOTE: This still saves the whole board
        const modelBoard: ModelBoard = {
          id: board.id,
          title: board.title,
          description: board.description || "",
          columns: board.columns.map((col) => ({
            id: col.id,
            title: col.title,
            boardId: board.id,
            // Use the updated card data when mapping
            cards: col.cards?.map((c) => {
              const cardToSave = c.id === card.id ? card : c; // Use the updated card if it matches
              return {
                id: cardToSave.id,
                title: cardToSave.title,
                description: cardToSave.description || "",
                columnId: cardToSave.columnId,
                boardId: board.id,
                tags: cardToSave.tags || [], // Use updated tags
                order: cardToSave.order || 0, // Use updated order
                createdAt: new Date(cardToSave.createdAt),
                updatedAt: new Date(cardToSave.updatedAt),
              };
            }),
            cardIds: col.cards?.map((c) => c.id) || [],
            order: (col as any).order || 0,
            createdAt: new Date(col.createdAt),
            updatedAt: new Date(col.updatedAt),
          })),
          createdAt: new Date(board.createdAt),
          // Update the board's updatedAt timestamp as well
          updatedAt: new Date(),
        };

        // ADDED: Log before saving
        logger.debug(
          `[handleUpdateCard] Attempting to save board ${modelBoard.id} after updating card ${card.id}`
        );

        await storage.saveBoard(modelBoard);

        // ADDED: Log after saving
        logger.debug(
          `[handleUpdateCard] Successfully saved board ${modelBoard.id}`
        );

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
          tags: card.tags || [], // Use updated tags for response
          order: card.order || 0, // Use updated order for response
          createdAt: new Date(card.createdAt),
          updatedAt: new Date(card.updatedAt),
        };

        return {
          command: "cardUpdated",
          data: {
            success: true,
            card: responseCard,
            columnId: card.columnId,
            boardId: message.data.boardId,
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
        boardId: message.data.boardId,
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
        boardId: message.data?.boardId || "",
        columnId: message.data?.columnId || "",
      },
    };
  }
}
