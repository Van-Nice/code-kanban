import { AddColumnMessage, ColumnResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { Column } from "../types";
import { sanitizeString } from "../utils";

export async function handleAddColumn(
  message: AddColumnMessage,
  context: HandlerContext
): Promise<ColumnResponse> {
  const { storage, logger } = context;

  if (!message.data?.boardId || !message.data?.column) {
    logger.error("Missing required fields for column addition");
    return {
      command: "columnAdded",
      data: {
        success: false,
        error: "Missing required fields: boardId or column data",
      },
    };
  }

  try {
    const boards = await storage.getBoards();
    const board = boards.find((b) => b.id === message.data.boardId);

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "columnAdded",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Add the column to the board
    const newColumn = {
      id: message.data.column.id,
      title: sanitizeString(message.data.column.title, 100),
      cards: [],
      order: board.columns.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    board.columns.push(newColumn);
    await storage.saveBoard(board);

    logger.debug("Column added successfully:", newColumn);
    return {
      command: "columnAdded",
      data: {
        success: true,
        column: newColumn,
        boardId: message.data.boardId,
      },
    };
  } catch (error) {
    logger.error("Error adding column:", error);
    return {
      command: "columnAdded",
      data: {
        success: false,
        error: `Failed to add column: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
