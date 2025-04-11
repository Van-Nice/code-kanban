import { AddCardMessage, CardAddedResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { v4 as uuidv4 } from "uuid";

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
      command: "cardAdded",
      data: {
        success: false,
        error: "Missing required fields: boardId, columnId, or title",
        boardId: message.data?.boardId || "",
        columnId: message.data?.columnId || "",
      },
    };
  }

  try {
    const boards = await storage.getBoards();
    const board = boards.find((b) => b.id === message.data.boardId);

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "cardAdded",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
          boardId: message.data.boardId,
          columnId: message.data.columnId,
        },
      };
    }

    // Create the new card
    const newCard = {
      id: uuidv4(),
      title: message.data.title.slice(0, 100) || "",
      description: message.data.description?.slice(0, 1000) || "",
      columnId: message.data.columnId,
      boardId: message.data.boardId,
      labels: [],
      assignee: "",
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await storage.saveCard(newCard);

    logger.debug(`Card with ID ${newCard.id} added successfully`);
    return {
      command: "cardAdded",
      data: {
        success: true,
        boardId: message.data.boardId,
        columnId: message.data.columnId,
        card: newCard,
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
        boardId: message.data.boardId,
        columnId: message.data.columnId,
      },
    };
  }
}
