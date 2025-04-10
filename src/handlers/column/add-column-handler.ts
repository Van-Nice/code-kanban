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
    // Sanitize column data
    const sanitizedColumn: Column = {
      id: message.data.column.id,
      title: sanitizeString(message.data.column.title, 100),
      cards: [],
    };

    // Get boards and find the target board
    const boards = storage.getBoards();
    const boardIndex = boards.findIndex((b) => b.id === message.data.boardId);

    if (boardIndex === -1) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "columnAdded",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Add column to board
    const board = boards[boardIndex];

    // Check for existing column with same ID
    if (board.columns.some((col) => col.id === sanitizedColumn.id)) {
      logger.error(
        `Column with ID ${sanitizedColumn.id} already exists in board ${message.data.boardId}`
      );
      return {
        command: "columnAdded",
        data: {
          success: false,
          error: `Column with ID ${sanitizedColumn.id} already exists`,
        },
      };
    }

    board.columns.push(sanitizedColumn);

    // Update the board's timestamp
    board.updatedAt = new Date().toISOString();

    // Save the updated boards
    await storage.saveBoards(boards);

    logger.debug(
      `Column ${sanitizedColumn.id} added to board ${message.data.boardId}`
    );
    return {
      command: "columnAdded",
      data: {
        success: true,
        column: sanitizedColumn,
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
