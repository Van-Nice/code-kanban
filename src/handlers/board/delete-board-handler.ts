import { DeleteBoardMessage, BoardDeletedResponse } from "../messages";
import { HandlerContext } from "../message-handler";

export async function handleDeleteBoard(
  message: DeleteBoardMessage,
  context: HandlerContext
): Promise<BoardDeletedResponse> {
  const { storage, logger } = context;

  if (!message.data?.boardId) {
    logger.error("No board ID provided for deletion");
    return {
      command: "boardDeleted",
      data: {
        success: false,
        error: "No board ID provided",
      },
    };
  }

  try {
    const boards = storage.getBoards();
    const boardIndex = boards.findIndex((b) => b.id === message.data.boardId);

    if (boardIndex === -1) {
      logger.error(
        `Board with ID ${message.data.boardId} not found for deletion`
      );
      return {
        command: "boardDeleted",
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Remove the board and save
    const updatedBoards = [
      ...boards.slice(0, boardIndex),
      ...boards.slice(boardIndex + 1),
    ];
    await storage.saveBoards(updatedBoards);

    logger.debug(`Board with ID ${message.data.boardId} deleted successfully`);
    return {
      command: "boardDeleted",
      data: {
        success: true,
        boardId: message.data.boardId,
      },
    };
  } catch (error) {
    logger.error(
      `Error deleting board with ID ${message.data.boardId}:`,
      error
    );
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
