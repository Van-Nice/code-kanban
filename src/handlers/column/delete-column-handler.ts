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
    const boards = await storage.getBoards();
    const board = boards.find((b) => b.id === message.data.boardId);

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "columnDeleted",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find and remove the column
    const columnIndex = board.columns.findIndex(
      (c) => c.id === message.data.columnId
    );
    if (columnIndex === -1) {
      logger.error(`Column with ID ${message.data.columnId} not found`);
      return {
        command: "columnDeleted",
        data: {
          success: false,
          error: `Column with ID ${message.data.columnId} not found`,
        },
      };
    }

    // Remove the column
    board.columns.splice(columnIndex, 1);

    // Update column orders
    board.columns.forEach((column, index) => {
      column.order = index;
    });

    await storage.saveBoard(board);

    logger.debug(
      `Column with ID ${message.data.columnId} deleted successfully`
    );
    return {
      command: "columnDeleted",
      data: {
        success: true,
        columnId: message.data.columnId,
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
