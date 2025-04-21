import { BoardStorage } from "./board/board-storage";
import { v4 as uuidv4 } from "uuid";
import { Commands } from "../shared/commands";
import * as vscode from "vscode";
import { Card as SharedCard } from "@shared/types"; // Import shared type
import { Card as ModelCard } from "@src/models/board"; // Import model type

/**
 * Directly adds a card using provided parameters.
 *
 * @param title The title of the card (required).
 * @param columnId The ID of the column to add the card to (required).
 * @param boardId The ID of the board the column belongs to (required).
 * @param description Optional description for the card.
 * @param tags Optional array of strings for tags (replaces labels).
 * @returns {Promise<boolean>} True if the card was added successfully, false otherwise.
 */
export async function directAddCardHandler(
  context: vscode.ExtensionContext,
  title: string,
  columnId: string,
  boardId: string,
  description?: string,
  tags?: string[] // Renamed from labels
): Promise<boolean> {
  console.log("🎯 Direct add card command called with:", {
    title,
    columnId,
    boardId,
    description,
    tags: Array.isArray(tags) ? tags.length : "not an array", // Log tag count
  });

  try {
    // Validate required parameters
    if (!title || !columnId || !boardId) {
      console.error(
        "🎯 DIRECT ADD CARD: Missing required fields (title, columnId, or boardId)"
      );
      vscode.window.showErrorMessage(
        "Failed to create card: Missing title, column ID, or board ID."
      );
      return false;
    }

    // Create the storage directly
    const storage = new BoardStorage(context);

    // Fetch the column to determine the order for the new card
    const column = await storage.getColumn(columnId);
    if (!column) {
      console.error(`🎯 DIRECT ADD CARD: Column ${columnId} not found.`);
      vscode.window.showErrorMessage(
        `Failed to create card: Column not found.`
      );
      return false;
    }
    const order = column.cards.length; // Place the new card at the end

    // Create the new card object conforming to ModelCard
    const newCard: ModelCard = {
      id: uuidv4(),
      title: title.slice(0, 100), // Ensure title respects limits
      description: description?.slice(0, 1000) || "", // Ensure description respects limits
      columnId: columnId,
      boardId: boardId,
      tags: tags || [], // Use tags
      order: order,
      createdAt: new Date(), // Use Date object
      updatedAt: new Date(), // Use Date object
    };

    console.log("🎯 DIRECT ADD CARD: Saving card:", newCard);

    // Save the card directly using the storage method
    await storage.saveCard(newCard);

    console.log("🎯 DIRECT ADD CARD: Card saved successfully!");

    // Show a success notification
    vscode.window.showInformationMessage(
      `Card "${title}" created successfully!`
    );

    // Optional: Trigger a refresh of the webview if necessary
    // This depends on how webviews are notified of external changes

    return true;
  } catch (err) {
    console.error("🎯 Error in direct card creation:", err);
    vscode.window.showErrorMessage(
      `Failed to create card: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return false;
  }
}
