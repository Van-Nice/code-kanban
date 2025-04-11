import { UpdateColumnMessage, ColumnResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { sanitizeString } from "../utils";
import { Board as HandlerBoard, Column as HandlerColumn } from "../board/board";
import { Board as ModelBoard, Column as ModelColumn } from "../../models/board";
import { convertToModelColumn } from "../../utils/type-conversions";

export async function handleUpdateColumn(
  message: UpdateColumnMessage,
  context: HandlerContext
): Promise<ColumnResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.columnId ||
    !message.data?.title
  ) {
    logger.error("Missing required fields for column update");
    return {
      command: "columnUpdated",
      data: {
        success: false,
        error: "Missing required fields: boardId, columnId, or title",
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
        command: "columnUpdated",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find and update the column
    const columnIndex = board.columns.findIndex(
      (c) => c.id === message.data.columnId
    );
    if (columnIndex === -1) {
      logger.error(`Column with ID ${message.data.columnId} not found`);
      return {
        command: "columnUpdated",
        data: {
          success: false,
          error: `Column with ID ${message.data.columnId} not found`,
        },
      };
    }

    // Update column properties
    const column = board.columns[columnIndex];
    column.title = sanitizeString(message.data.title, 100);

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
      `Column with ID ${message.data.columnId} updated successfully`
    );

    // Create a ModelColumn for the response
    const responseColumn: ModelColumn = {
      id: column.id,
      title: column.title,
      boardId: board.id,
      cards:
        column.cards?.map((c) => ({
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
        })) || [],
      cardIds: column.cards?.map((c) => c.id) || [],
      order: column.order || 0,
      createdAt: new Date(column.createdAt),
      updatedAt: new Date(column.updatedAt),
    };

    return {
      command: "columnUpdated",
      data: {
        success: true,
        column: responseColumn,
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
