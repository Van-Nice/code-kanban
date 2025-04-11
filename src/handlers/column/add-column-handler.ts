import { AddColumnMessage, ColumnResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { sanitizeString } from "../utils";
import { v4 as uuidv4 } from "uuid";
import { Column as ModelColumn } from "../../models/board";
import { Column as SharedColumn } from "../../shared/types";
import {
  convertToSharedColumn,
  convertToModelColumn,
} from "../../utils/type-conversions";

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
    const board = await storage.getBoard(message.data.boardId);
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
    const newColumn: ModelColumn = {
      id: message.data.columnId || uuidv4(),
      title: sanitizeString(message.data.title, 100),
      boardId: board.id,
      cards: [],
      cardIds: [],
      order: board.columns.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    board.columns.push(newColumn);
    await storage.saveBoard(board);

    logger.debug(`Column with ID ${newColumn.id} added successfully`);

    return {
      command: "columnAdded",
      data: {
        success: true,
        column: newColumn,
        boardId: board.id,
      },
    };
  } catch (error) {
    logger.error("Error adding column:", error);
    return {
      command: "columnAdded",
      data: {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add column",
      },
    };
  }
}
