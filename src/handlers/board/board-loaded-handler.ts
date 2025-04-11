import { BoardLoadedMessage } from "../messages";
import { HandlerContext } from "../message-handler";

/**
 * Handles the boardLoaded message sent from webview to extension
 * This is a confirmation message that the webview has received and processed the board data
 */
export async function handleBoardLoaded(
  message: BoardLoadedMessage,
  context: HandlerContext
): Promise<void> {
  const { logger } = context;

  logger.debug(`Webview has loaded board: ${message.data.title}`);

  // This message doesn't need to send a response back to the webview
  return;
}
