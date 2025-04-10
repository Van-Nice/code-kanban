import { DeleteBoardMessage, BoardDeletedResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { Board } from "../../models/board";

export async function handleDeleteBoard(
  message: DeleteBoardMessage,
  context: HandlerContext
): Promise<BoardDeletedResponse> {
  const { storage, logger } = context;

  if (!message.data?.boardId) {
    logger.error("Missing required fields for board deletion");
    return {
      command: "boardDeleted",
      data: {
        success: false,
        error: "Missing required field: boardId",
      },
    };
  }

  try {
    const boards = await storage.getBoards();
    const boardIndex = boards.findIndex((b) => b.id === message.data.boardId);

    if (boardIndex === -1) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "boardDeleted",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Remove the board
    boards.splice(boardIndex, 1);
    await storage.deleteBoard(message.data.boardId);

    logger.debug(`Board with ID ${message.data.boardId} deleted successfully`);
    return {
      command: "boardDeleted",
      data: {
        success: true,
        boardId: message.data.boardId,
      },
    };
  } catch (error) {
    logger.error("Error deleting board:", error);
    return {
      command: "boardDeleted",
      data: {
        success: false,
        error: `Failed to delete board: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
