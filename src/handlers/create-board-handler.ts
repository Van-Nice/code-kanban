import { CreateBoardMessage, BoardCreatedResponse } from "./messages";
import { HandlerContext } from "./message-handler";
import { Board } from "./types";
import { sanitizeString } from "./utils";

export async function handleCreateBoard(
  message: CreateBoardMessage,
  context: HandlerContext
): Promise<BoardCreatedResponse> {
  const { storage, logger } = context;

  if (!message.data?.id || !message.data?.title) {
    logger.error("Missing required fields for board creation");
    return {
      command: "boardCreated",
      data: {
        success: false,
        error: "Missing required fields: id or title",
      },
    };
  }

  const sanitizedTitle = sanitizeString(message.data.title, 100);
  const sanitizedDescription = sanitizeString(
    message.data.description || "",
    500
  );

  const newBoard: Board = {
    ...message.data,
    title: sanitizedTitle,
    description: sanitizedDescription,
    columns: [
      { id: "todo", title: "To Do", cards: [] },
      { id: "in-progress", title: "In Progress", cards: [] },
      { id: "done", title: "Done", cards: [] },
    ],
  };

  try {
    const boards = storage.getBoards();

    // Check for existing board with same ID
    if (boards.some((board) => board.id === newBoard.id)) {
      logger.error(`Board with ID ${newBoard.id} already exists`);
      return {
        command: "boardCreated",
        data: {
          success: false,
          error: `Board with ID ${newBoard.id} already exists`,
        },
      };
    }

    const updatedBoards = [...boards, newBoard];
    await storage.saveBoards(updatedBoards);

    logger.debug("Board created successfully:", newBoard);
    return {
      command: "boardCreated",
      data: {
        success: true,
        board: newBoard,
      },
    };
  } catch (error) {
    logger.error("Error creating board:", error);
    return {
      command: "boardCreated",
      data: {
        success: false,
        error: `Failed to create board: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
