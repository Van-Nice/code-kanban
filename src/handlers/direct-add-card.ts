import { BoardStorage } from "./board/board-storage";
import { v4 as uuidv4 } from "uuid";
import { Commands } from "../shared/commands";
import * as vscode from "vscode";

/**
 * Direct method to add a card to a column in a board
 * This bypasses the normal message handling system
 */
export async function directAddCard(
  title: string,
  columnId: string,
  boardId: string,
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  description: string = "",
  labels: string[] = [],
  assignee: string = ""
): Promise<boolean> {
  console.log("🚨 DIRECT ADD CARD called with:", {
    title,
    columnId,
    boardId,
    description: description ? `${description.length} chars` : "empty",
    labels: Array.isArray(labels) ? labels.length : "not an array",
    assignee: assignee || "none",
  });

  try {
    // Create storage
    const storage = new BoardStorage(context);

    // Validate parameters
    if (!title || !columnId || !boardId) {
      console.error("🚨 DIRECT ADD CARD: Missing required fields");
      console.error("  - title:", title ? "present" : "missing");
      console.error("  - columnId:", columnId ? "present" : "missing");
      console.error("  - boardId:", boardId ? "present" : "missing");
      return false;
    }

    // Check if column and board exist
    try {
      const boards = await storage.getBoards();
      const board = boards.find((b) => b.id === boardId);
      if (!board) {
        console.error(`🚨 DIRECT ADD CARD: Board ${boardId} does not exist`);
        return false;
      }

      const columns = await storage.getColumns(boardId);
      const column = columns.find((c) => c.id === columnId);
      if (!column) {
        console.error(
          `🚨 DIRECT ADD CARD: Column ${columnId} does not exist in board ${boardId}`
        );
        return false;
      }

      console.log(
        `🚨 DIRECT ADD CARD: Verified board and column exist. Board: ${board.title}, Column: ${column.title}`
      );
    } catch (err) {
      console.error(
        "🚨 DIRECT ADD CARD: Error verifying board and column:",
        err
      );
      return false;
    }

    // Create the new card
    const newCard = {
      id: uuidv4(),
      title: title.slice(0, 100) || "",
      description: description?.slice(0, 1000) || "",
      columnId: columnId,
      boardId: boardId,
      labels: labels || [],
      assignee: assignee || "",
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("🚨 DIRECT ADD CARD: Saving card:", newCard);

    // Save the card
    await storage.saveCard(newCard);

    console.log("🚨 DIRECT ADD CARD: Card saved successfully");

    // Send response to webview
    const response = {
      command: Commands.CARD_ADDED,
      data: {
        success: true,
        boardId: boardId,
        columnId: columnId,
        card: newCard,
      },
    };

    console.log("🚨 DIRECT ADD CARD: Sending response to webview");
    try {
      webview.postMessage(response);
      console.log("🚨 DIRECT ADD CARD: Response sent successfully");
    } catch (postError) {
      console.error(
        "🚨 DIRECT ADD CARD: Error sending response to webview:",
        postError
      );
    }

    return true;
  } catch (error) {
    console.error("🚨 DIRECT ADD CARD: Error adding card:", error);
    console.error(
      "🚨 Error details:",
      error instanceof Error ? error.stack : "No stack trace available"
    );

    // Send error response
    try {
      webview.postMessage({
        command: Commands.CARD_ADDED,
        data: {
          success: false,
          error: `Failed to add card: ${
            error instanceof Error ? error.message : String(error)
          }`,
          boardId: boardId,
          columnId: columnId,
        },
      });
    } catch (postError) {
      console.error(
        "🚨 DIRECT ADD CARD: Failed to send error response:",
        postError
      );
    }

    return false;
  }
}
