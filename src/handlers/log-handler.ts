import { LogMessage } from "./messages";
import { HandlerContext } from "./message-handler";

export async function handleLog(
  message: LogMessage,
  context: HandlerContext
): Promise<void> {
  const { logger } = context;
  logger.log(message.data.message, message.data.data);
}
