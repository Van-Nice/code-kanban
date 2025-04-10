import { AddColumnMessage, ColumnResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { sanitizeString } from "../utils";
import { v4 as uuidv4 } from "uuid";
import { Board as HandlerBoard, Column as HandlerColumn } from "../board/board";
import { Board as ModelBoard, Column as ModelColumn } from "../../models/board";

export async function handleAddColumn(
  message: AddColumnMessage,
  context: HandlerContext
): Promise<ColumnResponse> {
  const { storage, logger } = context;

  if (!message.data?.boardId || !message.data?.title) {
    logger.error("Missing required fields for column creation");
    return {
      command: "columnAdded",
      data: {
        success: false,
        error: "Missing required fields: boardId or title",
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
        command: "columnAdded",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Create new column
    const newColumn: HandlerColumn = {
      id: uuidv4(),
      title: sanitizeString(message.data.title, 100),
      cards: [],
      order: board.columns.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    board.columns.push(newColumn);

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
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        })),
        cardIds: col.cards?.map((c) => c.id) || [],
        createdAt: new Date(col.createdAt),
        updatedAt: new Date(col.updatedAt),
      })),
      createdAt: new Date(board.createdAt),
      updatedAt: new Date(board.updatedAt),
    };

    await storage.saveBoard(modelBoard);

    logger.debug(`Column with ID ${newColumn.id} added successfully`);

    // Create a ModelColumn for the response
    const responseColumn: ModelColumn = {
      id: newColumn.id,
      title: newColumn.title,
      boardId: board.id,
      cards: [],
      cardIds: [],
      createdAt: new Date(newColumn.createdAt),
      updatedAt: new Date(newColumn.updatedAt),
    };

    return {
      command: "columnAdded",
      data: {
        success: true,
        column: responseColumn,
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
