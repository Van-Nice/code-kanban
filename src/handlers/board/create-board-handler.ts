import { CreateBoardMessage, BoardCreatedResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { Board } from "../board/board";
import { v4 as uuidv4 } from "uuid";
import { convertToModelBoard } from "../../utils/type-conversions";

// Generate a unique ID using uuid
function generateId(): string {
  return uuidv4();
}

export async function handleCreateBoard(
  message: CreateBoardMessage,
  context: HandlerContext
): Promise<BoardCreatedResponse> {
  const { storage, logger } = context;

  // Validate required fields
  if (!message.data?.title) {
    logger.error("Missing required fields for board creation");
    return {
      command: "boardCreated",
      data: {
        success: false,
        error: "Missing required fields: title",
      },
    };
  }

  try {
    // Create a new board
    const newBoard: Board = {
      id: message.data.id || generateId(),
      title: message.data.title,
      description: message.data.description || "",
      columns: [],
      createdAt: message.data.createdAt || new Date().toISOString(),
      updatedAt: message.data.updatedAt || new Date().toISOString(),
    };

    // Save the board
    await storage.saveBoard(convertToModelBoard(newBoard));

    logger.debug(`Board with ID ${newBoard.id} created successfully`);
    return {
      command: "boardCreated",
      data: {
        success: true,
        board: convertToModelBoard(newBoard),
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
