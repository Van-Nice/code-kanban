import * as vscode from "vscode";
import { ShowErrorMessageMessage } from "./messages";
import { HandlerContext } from "./message-handler";

export async function handleShowErrorMessage(
  message: ShowErrorMessageMessage,
  context: HandlerContext
): Promise<void> {
  const { logger } = context;

  if (!message.data?.message) {
    logger.error("Missing message content for showErrorMessage command");
    return;
  }

  try {
    // Display the error message to the user
    logger.debug(`Showing error message: ${message.data.message}`);
    await vscode.window.showErrorMessage(message.data.message);
  } catch (error) {
    logger.error("Error showing error message:", error);
    // Just log the error since we can't do much else with a failed message display
  }
}
