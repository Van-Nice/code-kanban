import { AddCardMessage, CardAddedResponse } from "../../shared/message-types";
import { HandlerContext } from "../message-handler";
import { v4 as uuidv4 } from "uuid";
import { Commands } from "../../shared/commands";
import { Card as ModelCard } from "../../models/board";
import { Card as SharedCard } from "../../shared/types";
import { sanitizeString } from "../utils";
import { convertToSharedCard } from "../../utils/type-conversions";

export async function handleAddCard(
  message: AddCardMessage,
  context: HandlerContext
): Promise<CardAddedResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.columnId ||
    !message.data?.title
  ) {
    logger.error("Missing required fields for card addition");
    return {
      command: Commands.CARD_ADDED,
      data: {
        success: false,
        error: "Missing required fields: boardId, columnId, or title",
        boardId: message.data?.boardId || "",
        columnId: message.data?.columnId || "",
      },
    };
  }

  try {
    const column = await storage.getColumn(message.data.columnId);
    if (!column) {
      logger.error(`Column with ID ${message.data.columnId} not found`);
      return {
        command: Commands.CARD_ADDED,
        data: {
          success: false,
          error: `Column with ID ${message.data.columnId} not found`,
          boardId: message.data.boardId,
          columnId: message.data.columnId,
        },
      };
    }
    const order = column.cards.length;

    const newCard: ModelCard = {
      id: message.data.cardId || uuidv4(),
      title: sanitizeString(message.data.title, 100),
      description: sanitizeString(message.data.description || "", 1000),
      columnId: message.data.columnId,
      boardId: message.data.boardId,
      tags: message.data.tags || [],
      order: order,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await storage.saveCard(newCard);

    logger.debug(`Card with ID ${newCard.id} added successfully`);

    const sharedCardResponse: SharedCard = convertToSharedCard(newCard);

    return {
      command: Commands.CARD_ADDED,
      data: {
        success: true,
        boardId: message.data.boardId,
        columnId: message.data.columnId,
        card: sharedCardResponse,
      },
    };
  } catch (error) {
    logger.error("Error adding card:", error);
    return {
      command: Commands.CARD_ADDED,
      data: {
        success: false,
        error: `Failed to add card: ${
          error instanceof Error ? error.message : String(error)
        }`,
        boardId: message.data.boardId,
        columnId: message.data.columnId,
      },
    };
  }
}
