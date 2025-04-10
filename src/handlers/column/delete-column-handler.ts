import { DeleteColumnMessage, ColumnDeletedResponse } from "../messages";
import { HandlerContext } from "../message-handler";

export async function handleDeleteColumn(
  message: DeleteColumnMessage,
  context: HandlerContext
): Promise<ColumnDeletedResponse> {
  const { storage, logger } = context;

  if (!message.data?.boardId || !message.data?.columnId) {
    logger.error("Missing required fields for column deletion");
    return {
      command: "columnDeleted",
      data: {
        success: false,
        error: "Missing required fields: boardId or columnId",
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
        command: "columnDeleted",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find the target column
    const board = boards[boardIndex];
    const columnIndex = board.columns.findIndex(
      (c) => c.id === message.data.columnId
    );

    if (columnIndex === -1) {
      logger.error(
        `Column with ID ${message.data.columnId} not found in board ${message.data.boardId}`
      );
      return {
        command: "columnDeleted",
        data: {
          success: false,
          error: `Column with ID ${message.data.columnId} not found`,
        },
      };
    }

    // Don't allow deleting the last column in a board
    if (board.columns.length <= 1) {
      logger.error("Cannot delete the last column in a board");
      return {
        command: "columnDeleted",
        data: {
          success: false,
          error: "Cannot delete the last column in a board",
        },
      };
    }

    // Remove the column
    board.columns.splice(columnIndex, 1);

    // Update the board's timestamp
    board.updatedAt = new Date().toISOString();

    // Save the updated boards
    await storage.saveBoards(boards);

    logger.debug(
      `Column ${message.data.columnId} deleted from board ${message.data.boardId}`
    );
    return {
      command: "columnDeleted",
      data: {
        success: true,
        columnId: message.data.columnId,
        boardId: message.data.boardId,
      },
    };
  } catch (error) {
    logger.error("Error deleting column:", error);
    return {
      command: "columnDeleted",
      data: {
        success: false,
        error: `Failed to delete column: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
