import * as vscode from "vscode";
import { Board } from "../types";

export class BoardStorage {
  private context: vscode.ExtensionContext;
  private storageKey: string = "boogie.boards";
  private saveInProgress: boolean = false;
  private saveQueue: Array<{
    boards: Board[];
    resolve: (value: void | PromiseLike<void>) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public getBoards(): Board[] {
    try {
      // Try to get the data from storage
      const rawData = this.context.globalState.get<string | Board[]>(
        this.storageKey
      );

      // If it's a string (JSON), parse it
      if (typeof rawData === "string") {
        try {
          return JSON.parse(rawData);
        } catch (e) {
          console.error("ERROR - Failed to parse boards JSON:", e);
          return [];
        }
      }

      // If it's an array (direct object storage), return it
      if (Array.isArray(rawData)) {
        return rawData;
      }

      // If it's null or undefined, return empty array
      return [];
    } catch (error) {
      console.error("ERROR - Failed to get boards from storage:", error);
      return [];
    }
  }

  public async saveBoards(boards: Board[]): Promise<void> {
    // Return a promise that will be resolved when the save is complete
    return new Promise((resolve, reject) => {
      // Add this save request to the queue
      this.saveQueue.push({ boards, resolve, reject });

      // If no save is in progress, start processing the queue
      if (!this.saveInProgress) {
        this.processSaveQueue();
      } else {
        console.log("SAVE DEBUG - Save already in progress, request queued");
      }
    });
  }

  private async processSaveQueue(): Promise<void> {
    if (this.saveQueue.length === 0 || this.saveInProgress) {
      return;
    }

    this.saveInProgress = true;
    const { boards, resolve, reject } = this.saveQueue.shift()!;

    console.log(
      `SAVE DEBUG - Processing queued save request (${this.saveQueue.length} more in queue)`
    );
    console.log(`SAVE DEBUG - Attempting to save ${boards.length} boards`);

    try {
      if (!boards) {
        throw new Error("Cannot save null or undefined boards");
      }

      // Create a deep copy to avoid any reference issues
      const boardsCopy = JSON.parse(JSON.stringify(boards));

      // Log detailed card information before saving
      for (const board of boardsCopy) {
        console.log(
          `SAVE DEBUG - Board ${board.id} (${board.title}) before save:`
        );
        for (const column of board.columns) {
          console.log(
            `SAVE DEBUG - Column ${column.id} (${column.title}) has ${column.cards.length} cards`
          );
          if (column.cards.length > 0) {
            console.log(
              `SAVE DEBUG - First few cards in column ${column.id}:`,
              column.cards.slice(0, 3).map((c: any) => ({
                id: c.id,
                title: c.title,
                columnId: c.columnId,
              }))
            );
          }
        }
      }

      // Stringify the boards to ensure clean serialization
      const stringifiedBoards = JSON.stringify(boardsCopy);
      console.log(
        `SAVE DEBUG - Stringified boards size: ${stringifiedBoards.length} bytes`
      );

      // Perform the actual save using the string version
      await this.saveWithRetry(stringifiedBoards, 3);

      // Wait a moment to ensure data is written
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify the save was successful with a fresh read
      const savedBoards = this.getBoards();
      if (!savedBoards) {
        throw new Error("Failed to verify boards were saved - returned null");
      }
      if (savedBoards.length !== boardsCopy.length) {
        throw new Error(
          `Save verification failed - expected ${boardsCopy.length} boards but got ${savedBoards.length}`
        );
      }

      // Detailed verification of saved content
      for (const board of savedBoards) {
        console.log(
          `SAVE DEBUG - Verifying board ${board.id} (${board.title}) after save:`
        );
        const originalBoard = boardsCopy.find((b: Board) => b.id === board.id);
        if (!originalBoard) {
          console.error(
            `SAVE DEBUG - Original board ${board.id} not found in saved data!`
          );
          continue;
        }

        let totalCards = 0;
        for (const column of board.columns) {
          const originalColumn = originalBoard.columns.find(
            (c: { id: string }) => c.id === column.id
          );
          if (!originalColumn) {
            console.error(
              `SAVE DEBUG - Original column ${column.id} not found in saved data!`
            );
            continue;
          }

          console.log(
            `SAVE DEBUG - Column ${column.id} (${column.title}) has ${column.cards.length} cards after save ` +
              `(expected ${originalColumn.cards.length})`
          );

          if (column.cards.length !== originalColumn.cards.length) {
            console.error(
              `SAVE DEBUG - Card count mismatch in column ${column.id}!`
            );
          }

          totalCards += column.cards.length;

          // Log the first few cards for verification
          if (column.cards.length > 0) {
            console.log(
              `SAVE DEBUG - First few cards in column ${column.id} after save:`,
              column.cards.slice(0, 3).map((c: any) => ({
                id: c.id,
                title: c.title,
                columnId: c.columnId,
              }))
            );
          }
        }

        console.log(
          `SAVE DEBUG - Board ${board.id} has total ${totalCards} cards after save`
        );
      }

      console.log(
        `SAVE DEBUG - Successfully saved and verified ${boardsCopy.length} boards`
      );
      resolve();
    } catch (error) {
      console.error("CRITICAL ERROR - Failed to save boards:", error);
      reject(
        new Error(
          `Failed to save boards: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
    } finally {
      this.saveInProgress = false;

      // Process next save request in queue if any
      if (this.saveQueue.length > 0) {
        this.processSaveQueue();
      }
    }
  }

  // Helper method to retry save operations
  private async saveWithRetry(data: string, maxRetries: number): Promise<void> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`SAVE DEBUG - Save attempt ${attempt}/${maxRetries}`);
        await this.context.globalState.update(this.storageKey, data);
        console.log(`SAVE DEBUG - Save attempt ${attempt} successful`);
        return; // Success, exit the function
      } catch (error) {
        lastError = error;
        console.error(`SAVE DEBUG - Save attempt ${attempt} failed:`, error);
        // Wait longer between each retry
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }

    // If we reach this point, all retries failed
    throw new Error(
      `All ${maxRetries} save attempts failed. Last error: ${lastError}`
    );
  }
}
