import * as vscode from "vscode";
import { OpenBoardInEditorMessage } from "./messages";
import { HandlerContext } from "./message-handler";

export async function handleOpenBoardInEditor(
  message: OpenBoardInEditorMessage,
  context: HandlerContext
): Promise<void> {
  const { logger } = context;

  if (!message.data?.boardId) {
    logger.error("Missing boardId for openBoardInEditor command");
    return;
  }

  try {
    // Execute the openBoardInEditor command through VS Code
    logger.debug(`Opening board in editor: ${message.data.boardId}`);
    await vscode.commands.executeCommand(
      "boogie.openBoardInEditor",
      message.data.boardId
    );
  } catch (error) {
    logger.error("Error opening board in editor:", error);
    // Since this doesn't have a conventional response, just log the error
    vscode.window.showErrorMessage(
      `Failed to open board in editor: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
