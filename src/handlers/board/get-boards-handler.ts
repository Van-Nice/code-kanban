import { HandlerContext } from "../message-handler";
import { BoardsLoadedResponse } from "../messages";

export async function handleGetBoards(
  _message: any,
  context: HandlerContext
): Promise<BoardsLoadedResponse> {
  const { storage } = context;

  try {
    const boards = await storage.getBoards();
    return {
      command: "boardsLoaded",
      data: {
        success: true,
        boards,
      },
    };
  } catch (error) {
    return {
      command: "boardsLoaded",
      data: {
        success: false,
        boards: [],
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
