import { DeleteColumnMessage, ColumnDeletedResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { Board as HandlerBoard, Column as HandlerColumn } from "../board/board";
import { Board as ModelBoard, Column as ModelColumn } from "../../models/board";
import { convertToModelColumn } from "../../utils/type-conversions";

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
    const board = boards.find(
      (b) => b.id === message.data.boardId
    ) as unknown as HandlerBoard;

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
          labels: (c as any).labels || [],
          assignee: (c as any).assignee || "",
          order: (c as any).order || 0,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        })),
        cardIds: col.cards?.map((c) => c.id) || [],
        order: col.order || 0,
        createdAt: new Date(col.createdAt),
        updatedAt: new Date(col.updatedAt),
      })),
      createdAt: new Date(board.createdAt),
      updatedAt: new Date(board.updatedAt),
    };

    await storage.saveBoard(modelBoard);

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
