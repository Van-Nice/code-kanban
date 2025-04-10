import * as vscode from "vscode";
import { Board } from "../types";

export class BoardStorage {
  private context: vscode.ExtensionContext;
  private storageKey: string = "boogie.boards";

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public getBoards(): Board[] {
    return this.context.globalState.get<Board[]>(this.storageKey, []);
  }

  public async saveBoards(boards: Board[]): Promise<void> {
    console.log(`SAVE DEBUG - Attempting to save ${boards.length} boards`);
    try {
      if (!boards) {
        throw new Error("Cannot save null or undefined boards");
      }
      await this.context.globalState.update(this.storageKey, boards);
      const savedBoards = this.context.globalState.get<Board[]>(
        this.storageKey
      );
      if (!savedBoards) {
        throw new Error("Failed to verify boards were saved - returned null");
      }
      if (savedBoards.length !== boards.length) {
        throw new Error(
          `Save verification failed - expected ${boards.length} boards but got ${savedBoards.length}`
        );
      }
      console.log(
        `SAVE DEBUG - Successfully saved and verified ${boards.length} boards`
      );
    } catch (error) {
      console.error("CRITICAL ERROR - Failed to save boards:", error);
      throw new Error(
        `Failed to save boards: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
