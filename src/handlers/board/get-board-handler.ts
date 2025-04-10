import { GetBoardMessage, BoardLoadedResponse } from "../messages";
import { HandlerContext } from "../message-handler";

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

  // Detailed debugging for board loading
  logger.debug(
    `BOARD DEBUG - Request to load board with ID ${message.data.boardId}`
  );

  // Force a fresh fetch from storage
  const boards = await storage.getBoards();
  logger.debug(`BOARD DEBUG - Fetched ${boards.length} boards from storage`);

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

  // Log detailed column and card data
  logger.debug(
    `BOARD DEBUG - Found board: ${board.title} with ${board.columns.length} columns`
  );

  for (const column of board.columns) {
    logger.debug(
      `BOARD DEBUG - Column ${column.id} (${column.title}) has ${
        column.cards?.length || 0
      } cards`
    );

    if (column.cards && column.cards.length > 0) {
      logger.debug(
        `BOARD DEBUG - First 3 cards: ${JSON.stringify(
          column.cards.slice(0, 3).map((c) => ({
            id: c.id,
            title: c.title,
          }))
        )}`
      );
    }
  }

  // Ensure we return a deep copy to prevent reference issues
  const boardCopy = JSON.parse(JSON.stringify(board));

  logger.debug(`Found board: ${board.title}`);
  return {
    command: "boardLoaded",
    data: {
      success: true,
      columns: boardCopy.columns,
      title: boardCopy.title,
      context: context.webviewContext,
      updatedAt: boardCopy.updatedAt,
    },
  };
}
