import { UpdateBoardMessage, BoardResponse } from "../messages";
import { HandlerContext } from "../message-handler";

export async function handleUpdateBoard(
  message: UpdateBoardMessage,
  context: HandlerContext
): Promise<BoardResponse> {
  const { storage, logger } = context;

  if (!message.data?.boardId || !message.data?.columns) {
    logger.error("Missing required fields for board update");
    return {
      command: "boardUpdated",
      data: {
        success: false,
        error: "Missing required fields: boardId or columns",
      },
    };
  }

  try {
    // Get boards and find the target board
    const boards = await storage.getBoards();
    const boardIndex = boards.findIndex((b) => b.id === message.data.boardId);

    if (boardIndex === -1) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "boardUpdated",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Update the board columns
    const board = boards[boardIndex];
    board.columns = message.data.columns;

    // Update the board's timestamp
    board.updatedAt = new Date().toISOString();

    // Save the updated board
    await storage.saveBoard(board);

    logger.debug(`Board ${message.data.boardId} updated with new columns`);
    return {
      command: "boardUpdated",
      data: {
        success: true,
        board,
      },
    };
  } catch (error) {
    logger.error("Error updating board:", error);
    return {
      command: "boardUpdated",
      data: {
        success: false,
        error: `Failed to update board: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
