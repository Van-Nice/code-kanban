import * as vscode from "vscode";
import { ShowErrorMessageMessage } from "./messages";
import { HandlerContext } from "./message-handler";

interface ShowErrorMessageResponse {
  command: "errorMessageShown";
  data: {
    success: boolean;
    error?: string;
  };
}

export async function handleShowErrorMessage(
  message: ShowErrorMessageMessage,
  context: HandlerContext
): Promise<ShowErrorMessageResponse> {
  const { logger } = context;

  if (!message.data?.message) {
    logger.error("Missing message for showErrorMessage command");
    return {
      command: "errorMessageShown",
      data: {
        success: false,
        error: "Missing error message",
      },
    };
  }

  try {
    await vscode.window.showErrorMessage(message.data.message);
    return {
      command: "errorMessageShown",
      data: {
        success: true,
      },
    };
  } catch (error) {
    logger.error("Error showing error message:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      command: "errorMessageShown",
      data: {
        success: false,
        error: errorMessage,
      },
    };
  }
}
