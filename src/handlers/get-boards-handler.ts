import { GetBoardsMessage, BoardsLoadedResponse } from "../messages";
import { HandlerContext } from "./message-handler";

export async function handleGetBoards(
  message: GetBoardsMessage,
  context: HandlerContext
): Promise<BoardsLoadedResponse> {
  const { storage, logger } = context;

  logger.debug("Getting all boards");
  const boards = storage.getBoards();
  logger.debug(`Found ${boards.length} boards`);

  return {
    command: "boardsLoaded",
    data: {
      success: true,
      boards,
    },
  };
}
