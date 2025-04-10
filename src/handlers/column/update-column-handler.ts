import { UpdateColumnMessage, ColumnResponse } from "./messages";
import { HandlerContext } from "./message-handler";
import { sanitizeString } from "./utils";

export async function handleUpdateColumn(
  message: UpdateColumnMessage,
  context: HandlerContext
): Promise<ColumnResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.column ||
    !message.data?.column.id
  ) {
    logger.error("Missing required fields for column update");
    return {
      command: "columnUpdated",
      data: {
        success: false,
        error: "Missing required fields: boardId, column, or column.id",
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
        command: "columnUpdated",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find the target column
    const board = boards[boardIndex];
    const columnIndex = board.columns.findIndex(
      (c) => c.id === message.data.column.id
    );

    if (columnIndex === -1) {
      logger.error(
        `Column with ID ${message.data.column.id} not found in board ${message.data.boardId}`
      );
      return {
        command: "columnUpdated",
        data: {
          success: false,
          error: `Column with ID ${message.data.column.id} not found`,
        },
      };
    }

    // Update the column title (preserve existing cards)
    const existingColumn = board.columns[columnIndex];
    const updatedColumn = {
      ...existingColumn,
      title: sanitizeString(message.data.column.title, 100),
    };

    board.columns[columnIndex] = updatedColumn;

    // Update the board's timestamp
    board.updatedAt = new Date().toISOString();

    // Save the updated boards
    await storage.saveBoards(boards);

    logger.debug(
      `Column ${updatedColumn.id} updated in board ${message.data.boardId}`
    );
    return {
      command: "columnUpdated",
      data: {
        success: true,
        column: updatedColumn,
        boardId: message.data.boardId,
      },
    };
  } catch (error) {
    logger.error("Error updating column:", error);
    return {
      command: "columnUpdated",
      data: {
        success: false,
        error: `Failed to update column: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
