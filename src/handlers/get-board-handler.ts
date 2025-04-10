import { GetBoardMessage, BoardLoadedResponse } from "./messages";
import { HandlerContext } from "./message-handler";

export async function handleGetBoard(
  message: GetBoardMessage,
  context: HandlerContext
): Promise<BoardLoadedResponse> {
  const { storage, logger } = context;

  if (!message.data?.boardId) {
    logger.error("No board ID provided in message");
    return {
      command: "boardLoaded",
      data: {
        success: false,
        error: "No board ID provided",
      },
    };
  }

  const boards = storage.getBoards();
  const board = boards.find((b) => b.id === message.data.boardId);

  if (!board) {
    logger.error(`Board with ID ${message.data.boardId} not found`);
    return {
      command: "boardLoaded",
      data: {
        success: false,
        error: `Board with ID ${message.data.boardId} not found`,
      },
    };
  }

  logger.debug(`Found board: ${board.title}`);
  return {
    command: "boardLoaded",
    data: {
      success: true,
      columns: board.columns,
      title: board.title,
      context: context.webviewContext,
    },
  };
}
