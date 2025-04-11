import * as vscode from "vscode";
import {
  OpenBoardInEditorMessage,
  OpenBoardInEditorResponse,
} from "../messages";
import { HandlerContext } from "../message-handler";
import { Commands } from "../../shared/commands";

export async function handleOpenBoardInEditor(
  message: OpenBoardInEditorMessage,
  context: HandlerContext
): Promise<OpenBoardInEditorResponse> {
  const { logger, storage } = context;

  if (!message.data?.boardId) {
    logger.error("Missing boardId for openBoardInEditor command");
    return {
      command: Commands.BOARD_OPENED_IN_EDITOR,
      data: {
        success: false,
        error: "Missing boardId",
      },
    };
  }

  try {
    // First check if the board exists
    const board = await storage.getBoard(message.data.boardId);

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: Commands.BOARD_OPENED_IN_EDITOR,
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Execute the openBoardInEditor command through VS Code
    logger.debug(`Opening board in editor: ${message.data.boardId}`);
    await vscode.commands.executeCommand(
      "boogie.openBoardInEditor",
      message.data.boardId
    );
    return {
      command: Commands.BOARD_OPENED_IN_EDITOR,
      data: {
        success: true,
      },
    };
  } catch (error) {
    logger.error("Error opening board in editor:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(
      `Failed to open board in editor: ${errorMessage}`
    );
    return {
      command: Commands.BOARD_OPENED_IN_EDITOR,
      data: {
        success: false,
        error: errorMessage,
      },
    };
  }
}
