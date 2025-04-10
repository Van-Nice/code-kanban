import { UpdateBoardMessage, BoardUpdatedResponse } from "../messages";
import { HandlerContext } from "../message-handler";

export async function handleUpdateBoard(
  message: UpdateBoardMessage,
  context: HandlerContext
): Promise<BoardUpdatedResponse> {
  const { storage, logger } = context;

  try {
    const { boardId, title } = message.data;

    if (!boardId || !title) {
      return {
        command: "boardUpdated",
        data: {
          success: false,
          error: "Missing required fields: boardId and title",
        },
      };
    }

    const boards = await storage.getBoards();
    const board = boards.find((b) => b.id === boardId);

    if (!board) {
      logger.error(`Board with ID ${boardId} not found`);
      return {
        command: "boardUpdated",
        data: {
          success: false,
          error: `Board with ID ${boardId} not found`,
        },
      };
    }

    board.title = title;
    board.updatedAt = new Date();

    await storage.saveBoard(board);

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
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    };
  }
}
