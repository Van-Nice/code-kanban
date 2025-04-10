import { UpdateColumnMessage, ColumnResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { sanitizeString } from "../utils";

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
    const boards = await storage.getBoards();
    const board = boards.find((b) => b.id === message.data.boardId);

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "columnUpdated",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find and update the column
    const columnIndex = board.columns.findIndex(
      (c) => c.id === message.data.column.id
    );
    if (columnIndex === -1) {
      logger.error(`Column with ID ${message.data.column.id} not found`);
      return {
        command: "columnUpdated",
        data: {
          success: false,
          error: `Column with ID ${message.data.column.id} not found`,
        },
      };
    }

    // Update column properties
    const column = board.columns[columnIndex];
    column.title = sanitizeString(message.data.column.title, 100);

    await storage.saveBoard(board);

    logger.debug(
      `Column with ID ${message.data.column.id} updated successfully`
    );
    return {
      command: "columnUpdated",
      data: {
        success: true,
        column,
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
