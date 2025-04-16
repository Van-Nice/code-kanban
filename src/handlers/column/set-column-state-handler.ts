import type { HandlerContext } from "../message-handler"; // Assuming HandlerContext is exported from here
import type { SetColumnCollapseStateMessage } from "../../shared/message-types";

/**
 * Handles the 'setColumnCollapsedState' message from the webview.
 * Persists the collapsed state of a specific column using BoardStorage.
 *
 * @param message The incoming message containing boardId, columnId, and the collapsed state.
 * @param context The handler context providing access to storage, logger, etc.
 * @returns A promise that resolves when the state has been processed (no response sent back).
 */
export async function handleSetColumnCollapsedState(
  message: SetColumnCollapseStateMessage,
  context: HandlerContext
): Promise<void> {
  const { boardId, columnId, collapsed } = message.data;

  if (!boardId || !columnId || typeof collapsed !== "boolean") {
    context.logger.error(
      "Invalid message data received for setColumnCollapsedState",
      message.data
    );
    // Optionally send an error response back if needed, but for simple state saving,
    // logging might be sufficient.
    return;
  }

  context.logger.log(
    `Handling setColumnCollapsedState for ${boardId}/${columnId} to ${collapsed}`
  );

  try {
    // Call the storage method to persist the state
    await context.storage.setColumnCollapsedState(boardId, columnId, collapsed);
    context.logger.log(
      `Successfully persisted collapsed state for ${boardId}/${columnId}`
    );
  } catch (err) {
    context.logger.error(
      `Failed to set column collapsed state for ${boardId}/${columnId}`,
      err
    );
    // Again, decide if an error response to the webview is necessary.
  }

  // No explicit response message is needed for this action
}
