import { ErrorMessage } from "./messages";
import { HandlerContext } from "./message-handler";

export async function handleError(
  message: ErrorMessage,
  context: HandlerContext
): Promise<void> {
  const { logger } = context;
  logger.error(message.data.message, message.data.error);
}
