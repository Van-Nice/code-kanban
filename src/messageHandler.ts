import * as vscode from "vscode";

// Enhanced type definitions for better type safety
export interface WebviewMessageBase {
  command: string;
}

// Specific message type interfaces for each command
export interface LogMessage extends WebviewMessageBase {
  command: "log";
  data: { message: string; data?: any };
}

export interface ErrorMessage extends WebviewMessageBase {
  command: "error";
  data: { message: string; error?: any };
}

export interface GetBoardsMessage extends WebviewMessageBase {
  command: "getBoards";
}

export interface GetBoardMessage extends WebviewMessageBase {
  command: "getBoard";
  data: { boardId: string };
}

export interface CreateBoardMessage extends WebviewMessageBase {
  command: "createBoard";
  data: {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface DeleteBoardMessage extends WebviewMessageBase {
  command: "deleteBoard";
  data: { boardId: string };
}

export interface AddCardMessage extends WebviewMessageBase {
  command: "addCard";
  data: {
    boardId: string;
    columnId: string;
    card: Card;
  };
}

export interface UpdateCardMessage extends WebviewMessageBase {
  command: "updateCard";
  data: {
    boardId: string;
    columnId: string;
    card: Card;
  };
}

export interface DeleteCardMessage extends WebviewMessageBase {
  command: "deleteCard";
  data: {
    boardId: string;
    columnId: string;
    cardId: string;
  };
}

export interface MoveCardMessage extends WebviewMessageBase {
  command: "moveCard";
  data: {
    boardId: string;
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    position?: number; // Optional position in target column
  };
}

export interface OpenBoardInEditorMessage extends WebviewMessageBase {
  command: "openBoardInEditor";
  data: { boardId: string };
}

export interface ShowErrorMessageMessage extends WebviewMessageBase {
  command: "showErrorMessage";
  data: { message: string };
}

// Add these new interfaces for column operations
export interface AddColumnMessage extends WebviewMessageBase {
  command: "addColumn";
  data: {
    boardId: string;
    column: Column;
  };
}

export interface UpdateColumnMessage extends WebviewMessageBase {
  command: "updateColumn";
  data: {
    boardId: string;
    column: Column;
  };
}

export interface DeleteColumnMessage extends WebviewMessageBase {
  command: "deleteColumn";
  data: {
    boardId: string;
    columnId: string;
  };
}

// Union type of all possible message types (Suggestion 4)
export type WebviewMessage =
  | LogMessage
  | ErrorMessage
  | GetBoardsMessage
  | GetBoardMessage
  | CreateBoardMessage
  | DeleteBoardMessage
  | AddCardMessage
  | UpdateCardMessage
  | DeleteCardMessage
  | MoveCardMessage
  | AddColumnMessage
  | UpdateColumnMessage
  | DeleteColumnMessage
  | OpenBoardInEditorMessage
  | ShowErrorMessageMessage
  | WebviewMessageBase; // Fallback for backward compatibility

// Store for boards data
interface Board {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  columns: Column[];
}

interface Column {
  id: string;
  title: string;
  cards: Card[];
}

export interface Card {
  id: string;
  title: string;
  description: string;
  labels: string[];
  assignee: string;
  columnId?: string;
  boardId?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Response message types
interface ResponseMessageBase {
  command: string;
  data: {
    success: boolean;
    error?: string;
  };
}

// Extended response types for different commands
interface BoardsLoadedResponse extends ResponseMessageBase {
  command: "boardsLoaded";
  data: {
    success: boolean;
    boards: Board[];
    error?: string;
  };
}

interface BoardLoadedResponse extends ResponseMessageBase {
  command: "boardLoaded";
  data: {
    success: boolean;
    columns?: Column[];
    title?: string;
    context?: string;
    error?: string;
  };
}

interface BoardCreatedResponse extends ResponseMessageBase {
  command: "boardCreated";
  data: {
    success: boolean;
    board?: Board;
    error?: string;
  };
}

interface BoardDeletedResponse extends ResponseMessageBase {
  command: "boardDeleted";
  data: {
    success: boolean;
    boardId?: string;
    error?: string;
  };
}

interface CardResponse extends ResponseMessageBase {
  command: "cardAdded" | "cardUpdated";
  data: {
    success: boolean;
    card?: Card;
    columnId?: string;
    error?: string;
  };
}

interface CardDeletedResponse extends ResponseMessageBase {
  command: "cardDeleted";
  data: {
    success: boolean;
    cardId?: string;
    columnId?: string;
    error?: string;
  };
}

interface CardMovedResponse extends ResponseMessageBase {
  command: "cardMoved";
  data: {
    success: boolean;
    cardId?: string;
    fromColumnId?: string;
    toColumnId?: string;
    card?: Card;
    error?: string;
  };
}

// Add response interfaces for column operations
interface ColumnResponse extends ResponseMessageBase {
  command: "columnAdded" | "columnUpdated";
  data: {
    success: boolean;
    column?: Column;
    boardId?: string;
    error?: string;
  };
}

interface ColumnDeletedResponse extends ResponseMessageBase {
  command: "columnDeleted";
  data: {
    success: boolean;
    columnId?: string;
    boardId?: string;
    error?: string;
  };
}

// Union type for all response messages
type ResponseMessage =
  | BoardsLoadedResponse
  | BoardLoadedResponse
  | BoardCreatedResponse
  | BoardDeletedResponse
  | CardResponse
  | CardDeletedResponse
  | CardMovedResponse
  | ColumnResponse
  | ColumnDeletedResponse
  | ResponseMessageBase;

// Storage key for boards in VSCode's global storage
const BOARDS_STORAGE_KEY = "boogie.boards";

// Simple logger utility (Suggestion 5)
class Logger {
  private enableDebug: boolean;

  constructor(options: { debug: boolean }) {
    this.enableDebug = options.debug;
  }

  log(message: string, data?: any): void {
    console.log(message, data);
  }

  debug(message: string, data?: any): void {
    if (this.enableDebug) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }

  error(message: string, error?: any): void {
    console.error(`[ERROR] ${message}`, error);
  }

  info(message: string, data?: any): void {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : "");
  }
}

export class MessageHandler {
  private webview: vscode.Webview;
  private context: vscode.ExtensionContext;
  private webviewContext: string;
  private logger: Logger;

  constructor(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    webviewContext: string = "sidebar"
  ) {
    this.webview = webview;
    this.context = context;
    this.webviewContext = webviewContext;

    // Initialize logger with debug mode based on environment (Suggestion 5)
    this.logger = new Logger({
      debug:
        process.env.NODE_ENV === "development" ||
        Boolean(process.env.DEBUG === "true"),
    });
  }

  // Get boards from storage
  private getBoards(): Board[] {
    return this.context.globalState.get<Board[]>(BOARDS_STORAGE_KEY, []);
  }

  // Save boards to storage
  private async saveBoards(boards: Board[]): Promise<void> {
    console.log(`SAVE DEBUG - Attempting to save ${boards.length} boards`);

    try {
      // Make sure we're not saving null or undefined
      if (!boards) {
        throw new Error("Cannot save null or undefined boards");
      }

      // Save the boards
      await this.context.globalState.update(BOARDS_STORAGE_KEY, boards);

      // Verify the save was successful by reading back the data
      const savedBoards =
        this.context.globalState.get<Board[]>(BOARDS_STORAGE_KEY);

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

  // Centralized Error Handling (Suggestion 1)
  public async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      this.logger.debug("Received message from webview:", message);
      this.logger.info("Webview context:", this.webviewContext);

      // Input validation (Suggestion 2)
      if (!message || !message.command) {
        throw new Error("Invalid message: missing command");
      }

      // Dispatch to appropriate handler (Suggestion 3)
      switch (message.command) {
        case "log":
          this.handleLog(message as LogMessage);
          break;
        case "error":
          this.handleError(message as ErrorMessage);
          break;
        case "showErrorMessage":
          this.handleShowErrorMessage(message as ShowErrorMessageMessage);
          break;
        case "getBoards":
          await this.handleGetBoards();
          break;
        case "getBoard":
          await this.handleGetBoard(message as GetBoardMessage);
          break;
        case "createBoard":
          await this.handleCreateBoard(message as CreateBoardMessage);
          break;
        case "deleteBoard":
          await this.handleDeleteBoard(message as DeleteBoardMessage);
          break;
        case "addCard":
          await this.handleAddCard(message as AddCardMessage);
          break;
        case "updateCard":
          await this.handleUpdateCard(message as UpdateCardMessage);
          break;
        case "deleteCard":
          await this.handleDeleteCard(message as DeleteCardMessage);
          break;
        case "moveCard":
          await this.handleMoveCard(message as MoveCardMessage);
          break;
        case "openBoardInEditor":
          this.handleOpenBoardInEditor(message as OpenBoardInEditorMessage);
          break;
        case "addColumn":
          await this.handleAddColumn(message as AddColumnMessage);
          break;
        case "updateColumn":
          await this.handleUpdateColumn(message as UpdateColumnMessage);
          break;
        case "deleteColumn":
          await this.handleDeleteColumn(message as DeleteColumnMessage);
          break;
        default:
          this.logger.error(`Unknown command: ${message.command}`);
      }
    } catch (error) {
      // Catch any unexpected errors and provide useful feedback (Suggestion 1, 8)
      this.logger.error("Unexpected error in handleMessage:", error);

      // Determine response command based on original command
      const responseCommand =
        message && message.command
          ? `${message.command.replace(/^([^A-Z])/, (match) =>
              match.toUpperCase()
            )}Failed`
          : "operationFailed";

      this.sendMessage({
        command: responseCommand,
        data: {
          success: false,
          error: `An unexpected error occurred: ${
            error instanceof Error ? error.message : "Unknown error"
          }. Please try again or contact support.`,
        },
      });
    }
  }

  // Individual command handlers (Suggestion 3)
  private handleLog(message: LogMessage): void {
    if (!message.data?.message) {
      this.logger.error("Log message is missing required data");
      return;
    }
    this.logger.log(`[Webview] ${message.data.message}`, message.data.data);
  }

  private handleError(message: ErrorMessage): void {
    if (!message.data?.message) {
      this.logger.error("Error message is missing required data");
      return;
    }
    this.logger.error(`[Webview] ${message.data.message}`, message.data.error);
  }

  private async handleGetBoards(): Promise<void> {
    const boards = this.getBoards();
    this.sendMessage({
      command: "boardsLoaded",
      data: {
        success: true,
        boards,
      },
    } as BoardsLoadedResponse);
  }

  private async handleGetBoard(message: GetBoardMessage): Promise<void> {
    // Input validation (Suggestion 2, 7)
    if (!message.data?.boardId) {
      this.sendMessage({
        command: "boardLoaded",
        data: {
          success: false,
          error: "Missing required field: boardId",
        },
      } as BoardLoadedResponse);
      return;
    }

    const allBoards = this.getBoards();
    const board = allBoards.find((b) => b.id === message.data.boardId);

    if (board) {
      this.sendMessage({
        command: "boardLoaded",
        data: {
          success: true,
          columns: board.columns,
          title: board.title,
          context: this.webviewContext,
        },
      } as BoardLoadedResponse);
    } else {
      // Enhanced error message (Suggestion 8)
      this.sendMessage({
        command: "boardLoaded",
        data: {
          success: false,
          error: `Board with ID '${message.data.boardId}' not found. It may have been deleted or you may have provided an invalid ID.`,
        },
      } as BoardLoadedResponse);
    }
  }

  private async handleCreateBoard(message: CreateBoardMessage): Promise<void> {
    // Input validation (Suggestion 2, 7)
    if (!message.data?.id || !message.data?.title) {
      this.sendMessage({
        command: "boardCreated",
        data: {
          success: false,
          error: "Missing required fields: id or title",
        },
      } as BoardCreatedResponse);
      return;
    }

    // Sanitize input (Suggestion 7)
    const sanitizedTitle = this.sanitizeString(message.data.title, 100);
    const sanitizedDescription = this.sanitizeString(
      message.data.description || "",
      500
    );

    const newBoard: Board = {
      ...message.data,
      title: sanitizedTitle,
      description: sanitizedDescription,
      columns: [
        { id: "todo", title: "To Do", cards: [] },
        { id: "in-progress", title: "In Progress", cards: [] },
        { id: "done", title: "Done", cards: [] },
      ],
    };

    const updatedBoards = [...this.getBoards(), newBoard];
    await this.saveBoards(updatedBoards);

    this.sendMessage({
      command: "boardCreated",
      data: {
        success: true,
        board: newBoard,
      },
    } as BoardCreatedResponse);
  }

  private async handleDeleteBoard(message: DeleteBoardMessage): Promise<void> {
    // Input validation (Suggestion 2, 7)
    if (!message.data?.boardId) {
      this.sendMessage({
        command: "boardDeleted",
        data: {
          success: false,
          error: "Missing required field: boardId",
        },
      } as BoardDeletedResponse);
      return;
    }

    const boardsToUpdate = this.getBoards();
    const boardIndex = boardsToUpdate.findIndex(
      (b) => b.id === message.data.boardId
    );

    if (boardIndex !== -1) {
      boardsToUpdate.splice(boardIndex, 1);
      await this.saveBoards(boardsToUpdate);

      this.sendMessage({
        command: "boardDeleted",
        data: {
          success: true,
          boardId: message.data.boardId,
        },
      } as BoardDeletedResponse);
    } else {
      // Enhanced error message (Suggestion 8)
      this.sendMessage({
        command: "boardDeleted",
        data: {
          success: false,
          error: `Board with ID '${message.data.boardId}' not found. It may have already been deleted.`,
        },
      } as BoardDeletedResponse);
    }
  }

  private async handleAddCard(message: AddCardMessage): Promise<void> {
    this.logger.debug("⭐ CARD ADD - Processing addCard message", message.data);

    // Input validation (Suggestion 2, 7)
    if (
      !message.data?.boardId ||
      !message.data?.columnId ||
      !message.data?.card
    ) {
      this.logger.error("⭐ CARD ADD - Missing required fields");
      this.sendMessage({
        command: "cardAdded",
        data: {
          success: false,
          error: "Missing required fields: boardId, columnId, or card data",
        },
      } as CardResponse);
      return;
    }

    this.logger.debug("⭐ CARD ADD - Card data received", {
      title: message.data.card.title,
      columnId: message.data.columnId,
      boardId: message.data.boardId,
    });

    // Sanitize card data (Suggestion 7)
    const sanitizedCard: Card = {
      ...message.data.card,
      title: this.sanitizeString(message.data.card.title, 100),
      description: this.sanitizeString(
        message.data.card.description || "",
        1000
      ),
      labels: Array.isArray(message.data.card.labels)
        ? message.data.card.labels
            .slice(0, 10)
            .map((label) => this.sanitizeString(label, 50))
        : [],
      assignee: this.sanitizeString(message.data.card.assignee || "", 100),
    };

    this.logger.debug("⭐ CARD ADD - Sanitized card data", {
      title: sanitizedCard.title,
      id: sanitizedCard.id,
    });

    const boardsForAdd = this.getBoards();
    this.logger.debug("⭐ CARD ADD - Retrieved boards", {
      count: boardsForAdd.length,
    });

    const targetBoard = boardsForAdd.find((b) => b.id === message.data.boardId);

    if (targetBoard) {
      this.logger.debug(`⭐ CARD ADD - Found target board`, {
        title: targetBoard.title,
        id: targetBoard.id,
      });

      const column = targetBoard.columns.find(
        (c) => c.id === message.data.columnId
      );

      if (column) {
        this.logger.debug(`⭐ CARD ADD - Found target column`, {
          title: column.title,
          id: column.id,
          cardCount: column.cards.length,
        });

        column.cards.push(sanitizedCard);
        targetBoard.updatedAt = new Date().toISOString();

        try {
          this.logger.debug("⭐ CARD ADD - Saving updated boards");
          await this.saveBoards(boardsForAdd);
          this.logger.debug("⭐ CARD ADD - Boards saved successfully");

          this.logger.debug("⭐ CARD ADD - Sending success response");
          this.sendMessage({
            command: "cardAdded",
            data: {
              success: true,
              card: sanitizedCard,
              columnId: message.data.columnId,
            },
          } as CardResponse);
          this.logger.debug("⭐ CARD ADD - Response sent");
        } catch (error) {
          this.logger.error("⭐ CARD ADD - Error saving boards", error);
          this.sendMessage({
            command: "cardAdded",
            data: {
              success: false,
              error:
                "Failed to save card: " +
                (error instanceof Error ? error.message : String(error)),
            },
          } as CardResponse);
        }
      } else {
        // Enhanced error message (Suggestion 8)
        this.logger.error(`⭐ CARD ADD - Column not found`, {
          columnId: message.data.columnId,
        });
        this.sendMessage({
          command: "cardAdded",
          data: {
            success: false,
            error: `Column with ID '${message.data.columnId}' not found in board '${targetBoard.title}'.`,
          },
        } as CardResponse);
      }
    } else {
      // Enhanced error message (Suggestion 8)
      this.logger.error(`⭐ CARD ADD - Board not found`, {
        boardId: message.data.boardId,
      });
      this.sendMessage({
        command: "cardAdded",
        data: {
          success: false,
          error: `Board with ID '${message.data.boardId}' not found. Please refresh the view.`,
        },
      } as CardResponse);
    }
  }

  private async handleUpdateCard(message: UpdateCardMessage): Promise<void> {
    try {
      console.log(
        "CARD UPDATE DEBUG - Processing updateCard message:",
        JSON.stringify(message.data, null, 2)
      );
      this.logger.debug(
        "Processing updateCard message with data:",
        message.data
      );

      // Input validation (Suggestion 2, 7)
      if (!message.data) {
        throw new Error("Missing message data");
      }

      if (!message.data.boardId) {
        throw new Error("Missing boardId");
      }

      if (!message.data.columnId) {
        throw new Error("Missing columnId");
      }

      if (!message.data.card || !message.data.card.id) {
        throw new Error("Missing card data or card ID");
      }

      // Debug card data before sanitization
      console.log("CARD UPDATE DEBUG - Card data before sanitization:");
      console.log(`- Card ID: ${message.data.card.id}`);
      console.log(`- Title: "${message.data.card.title}"`);
      console.log(`- Description: "${message.data.card.description || ""}"`);
      console.log(`- Column ID: ${message.data.columnId}`);
      console.log(`- Board ID: ${message.data.boardId}`);

      // Sanitize card data (Suggestion 7)
      const sanitizedCard: Card = {
        ...message.data.card,
        title: this.sanitizeString(message.data.card.title, 100),
        description: this.sanitizeString(
          message.data.card.description || "",
          1000
        ),
        labels: Array.isArray(message.data.card.labels)
          ? message.data.card.labels
              .slice(0, 10)
              .map((label) => this.sanitizeString(label, 50))
          : [],
        assignee: this.sanitizeString(message.data.card.assignee || "", 100),
      };

      // Debug sanitized data
      console.log("CARD UPDATE DEBUG - Sanitized card data:");
      console.log(`- Card ID: ${sanitizedCard.id}`);
      console.log(`- Title: "${sanitizedCard.title}"`);

      // Get current boards
      const boardsForUpdate = this.getBoards();
      console.log(
        "CARD UPDATE DEBUG - Boards retrieved:",
        boardsForUpdate.length
      );

      if (!boardsForUpdate || boardsForUpdate.length === 0) {
        console.error("ERROR: No boards found in storage");
        throw new Error("No boards found in storage");
      }

      const boardToUpdate = boardsForUpdate.find(
        (b) => b.id === message.data.boardId
      );

      if (!boardToUpdate) {
        throw new Error(`Board with ID '${message.data.boardId}' not found`);
      }

      console.log(`CARD UPDATE DEBUG - Found board: ${boardToUpdate.title}`);

      // First check the target column specified in the message
      const targetColumn = boardToUpdate.columns.find(
        (c) => c.id === message.data.columnId
      );

      if (!targetColumn) {
        throw new Error(
          `Column with ID '${message.data.columnId}' not found in board '${boardToUpdate.title}'`
        );
      }

      console.log(
        `CARD UPDATE DEBUG - Target column found: ${targetColumn.title}`
      );

      // Look for the card in the target column first
      let cardIndex = targetColumn.cards.findIndex(
        (c) => c.id === sanitizedCard.id
      );

      if (cardIndex !== -1) {
        // Card is in the expected column
        console.log(
          `CARD UPDATE DEBUG - Card found in target column at index ${cardIndex}`
        );

        // Update the card
        const oldCard = targetColumn.cards[cardIndex];
        console.log(
          `CARD UPDATE DEBUG - Replacing title "${oldCard.title}" with "${sanitizedCard.title}"`
        );

        // Update the card in the column
        targetColumn.cards[cardIndex] = sanitizedCard;
      } else {
        // Card wasn't in the expected column, search all columns
        console.log(
          `CARD UPDATE DEBUG - Card not found in target column, searching all columns`
        );

        let foundInColumn: Column | null = null;

        for (const column of boardToUpdate.columns) {
          const idx = column.cards.findIndex((c) => c.id === sanitizedCard.id);
          if (idx !== -1) {
            foundInColumn = column;
            cardIndex = idx;
            console.log(
              `CARD UPDATE DEBUG - Found card in column ${column.id} (${column.title}) at index ${idx}`
            );
            break;
          }
        }

        if (!foundInColumn) {
          // Card doesn't exist in any column - this is an error
          throw new Error(
            `Card with ID '${sanitizedCard.id}' not found in any column of board '${boardToUpdate.title}'`
          );
        }

        // Update the columnId to match the message's intent
        sanitizedCard.columnId = message.data.columnId;
        console.log(
          `CARD UPDATE DEBUG - Setting columnId to "${sanitizedCard.columnId}"`
        );

        // Remove card from original column
        const cardToMove = foundInColumn.cards.splice(cardIndex, 1)[0];
        console.log(
          `CARD UPDATE DEBUG - Removed card from column ${foundInColumn.id}`
        );

        // Add to target column
        targetColumn.cards.push(sanitizedCard);
        console.log(
          `CARD UPDATE DEBUG - Added card to column ${targetColumn.id}`
        );
      }

      // Update timestamp
      boardToUpdate.updatedAt = new Date().toISOString();

      // Save the updated boards
      try {
        await this.saveBoards(boardsForUpdate);
        console.log("CARD UPDATE DEBUG - Successfully saved boards to storage");
      } catch (saveError) {
        console.error("CRITICAL ERROR - Failed to save boards:", saveError);
        throw saveError;
      }

      // Verify the save was successful
      const verifiedBoards = this.getBoards();
      const verifiedBoard = verifiedBoards.find(
        (b) => b.id === message.data.boardId
      );

      let verificationSuccessful = false;
      let verifiedCard = null;

      if (verifiedBoard) {
        console.log("CARD UPDATE DEBUG - Found board after save");

        // Search for card in all columns (it might have moved)
        for (const column of verifiedBoard.columns) {
          const card = column.cards.find((c) => c.id === sanitizedCard.id);
          if (card) {
            verifiedCard = card;
            console.log(
              `CARD UPDATE DEBUG - Found card in column ${column.id} after save`
            );
            console.log(`CARD UPDATE DEBUG - Verified title: "${card.title}"`);

            // Check if the verification was successful
            verificationSuccessful = card.title === sanitizedCard.title;
            break;
          }
        }
      }

      if (verificationSuccessful && verifiedCard) {
        console.log(
          "CARD UPDATE DEBUG - Verification successful, sending success response"
        );

        // Success confirmation
        this.sendMessage({
          command: "cardUpdated",
          data: {
            success: true,
            card: verifiedCard,
            columnId: message.data.columnId,
          },
        } as CardResponse);
      } else {
        console.error("CARD UPDATE DEBUG - Verification failed!");

        // Error handling
        this.sendMessage({
          command: "cardUpdated",
          data: {
            success: false,
            error: "Failed to verify changes were persisted",
          },
        } as CardResponse);
      }
    } catch (error) {
      // Enhanced error handling
      console.error("Error updating card:", error);
      this.logger.error("Error updating card:", error);

      this.sendMessage({
        command: "cardUpdated",
        data: {
          success: false,
          error:
            error instanceof Error
              ? `Failed to update card: ${error.message}`
              : "An unknown error occurred while updating the card",
        },
      } as CardResponse);
    }
  }

  private async handleDeleteCard(message: DeleteCardMessage): Promise<void> {
    // Input validation (Suggestion 2, 7)
    if (
      !message.data?.boardId ||
      !message.data?.columnId ||
      !message.data?.cardId
    ) {
      this.sendMessage({
        command: "cardDeleted",
        data: {
          success: false,
          error: "Missing required fields: boardId, columnId, or cardId",
        },
      } as CardDeletedResponse);
      return;
    }

    const boardsForDelete = this.getBoards();
    const boardForDelete = boardsForDelete.find(
      (b) => b.id === message.data.boardId
    );

    if (boardForDelete) {
      const columnForDelete = boardForDelete.columns.find(
        (c) => c.id === message.data.columnId
      );

      if (columnForDelete) {
        const cardIndex = columnForDelete.cards.findIndex(
          (c) => c.id === message.data.cardId
        );

        if (cardIndex !== -1) {
          columnForDelete.cards.splice(cardIndex, 1);
          boardForDelete.updatedAt = new Date().toISOString();
          await this.saveBoards(boardsForDelete);

          this.sendMessage({
            command: "cardDeleted",
            data: {
              success: true,
              cardId: message.data.cardId,
              columnId: message.data.columnId,
            },
          } as CardDeletedResponse);
        } else {
          // Enhanced error message (Suggestion 8)
          this.sendMessage({
            command: "cardDeleted",
            data: {
              success: false,
              error: `Card with ID '${message.data.cardId}' not found in column '${columnForDelete.title}'.`,
            },
          } as CardDeletedResponse);
        }
      } else {
        // Enhanced error message (Suggestion 8)
        this.sendMessage({
          command: "cardDeleted",
          data: {
            success: false,
            error: `Column with ID '${message.data.columnId}' not found in board '${boardForDelete.title}'.`,
          },
        } as CardDeletedResponse);
      }
    } else {
      // Enhanced error message (Suggestion 8)
      this.sendMessage({
        command: "cardDeleted",
        data: {
          success: false,
          error: `Board with ID '${message.data.boardId}' not found. Please refresh the view.`,
        },
      } as CardDeletedResponse);
    }
  }

  private async handleMoveCard(message: MoveCardMessage): Promise<void> {
    // Input validation (Suggestion 2, 7)
    if (
      !message.data?.boardId ||
      !message.data?.cardId ||
      !message.data?.fromColumnId ||
      !message.data?.toColumnId
    ) {
      this.sendMessage({
        command: "cardMoved",
        data: {
          success: false,
          error:
            "Missing required fields: boardId, cardId, fromColumnId, or toColumnId",
        },
      } as CardMovedResponse);
      return;
    }

    const boardsForMove = this.getBoards();
    const boardForMove = boardsForMove.find(
      (b) => b.id === message.data.boardId
    );

    if (boardForMove) {
      const fromColumn = boardForMove.columns.find(
        (c) => c.id === message.data.fromColumnId
      );
      const toColumn = boardForMove.columns.find(
        (c) => c.id === message.data.toColumnId
      );

      if (fromColumn && toColumn) {
        const cardIndex = fromColumn.cards.findIndex(
          (c) => c.id === message.data.cardId
        );

        if (cardIndex !== -1) {
          const [card] = fromColumn.cards.splice(cardIndex, 1);

          // Update the card's columnId to match its new column
          card.columnId = message.data.toColumnId;
          card.updatedAt = new Date().toISOString();

          // Log the card movement details for debugging
          console.log(`[CARD MOVE] Moving card details:`);
          console.log(`- Card ID: ${card.id}`);
          console.log(`- Card Title: "${card.title}"`);
          console.log(
            `- From Column: ${fromColumn.title} (${message.data.fromColumnId})`
          );
          console.log(
            `- To Column: ${toColumn.title} (${message.data.toColumnId})`
          );
          console.log(`- Updated columnId property to: ${card.columnId}`);

          // Handle placement at specific position if provided
          if (
            typeof message.data.position === "number" &&
            message.data.position >= 0 &&
            message.data.position <= toColumn.cards.length
          ) {
            // Insert at specific position
            console.log(`- Inserting at position: ${message.data.position}`);
            toColumn.cards.splice(message.data.position, 0, card);
          } else {
            // Default: append to end
            console.log(
              `- Appending to end (position: ${toColumn.cards.length})`
            );
            toColumn.cards.push(card);
          }

          // Update card order properties
          toColumn.cards.forEach((c, index) => {
            c.order = index;
          });

          boardForMove.updatedAt = new Date().toISOString();
          await this.saveBoards(boardsForMove);

          this.sendMessage({
            command: "cardMoved",
            data: {
              success: true,
              cardId: message.data.cardId,
              fromColumnId: message.data.fromColumnId,
              toColumnId: message.data.toColumnId,
              card: card, // Include the updated card in the response
            },
          } as CardMovedResponse);
        } else {
          // Enhanced error message (Suggestion 8)
          this.sendMessage({
            command: "cardMoved",
            data: {
              success: false,
              error: `Card with ID '${message.data.cardId}' not found in column '${fromColumn.title}'.`,
            },
          } as CardMovedResponse);
        }
      } else {
        // Enhanced error message (Suggestion 8)
        this.sendMessage({
          command: "cardMoved",
          data: {
            success: false,
            error: `One or both columns not found: fromColumn '${message.data.fromColumnId}' or toColumn '${message.data.toColumnId}'.`,
          },
        } as CardMovedResponse);
      }
    } else {
      // Enhanced error message (Suggestion 8)
      this.sendMessage({
        command: "cardMoved",
        data: {
          success: false,
          error: `Board with ID '${message.data.boardId}' not found. Please refresh the view.`,
        },
      } as CardMovedResponse);
    }
  }

  private handleOpenBoardInEditor(message: OpenBoardInEditorMessage): void {
    // Input validation (Suggestion 2, 7)
    if (!message.data?.boardId) {
      this.logger.error("openBoardInEditor: boardId is missing");
      return;
    }

    vscode.commands.executeCommand(
      "boogie.openBoardInEditor",
      message.data.boardId
    );
  }

  private handleShowErrorMessage(message: ShowErrorMessageMessage): void {
    if (!message.data?.message) {
      this.logger.error("ShowErrorMessage message is missing required data");
      return;
    }
    vscode.window.showErrorMessage(message.data.message);
  }

  public sendMessage(message: WebviewMessage | ResponseMessage): void {
    if (message.command === "cardUpdated") {
      // Narrow the type to ensure we can access the data property
      const cardResponse = message as CardResponse;
      console.log(
        "🟢 RESPONSE: Sending cardUpdated response to webview:",
        JSON.stringify(cardResponse.data, null, 2)
      );

      // Add a timestamp to track when the response was sent
      const sendTime = new Date().toISOString();
      console.log(`🟢 RESPONSE: Timestamp ${sendTime}`);

      try {
        this.webview.postMessage(message);
        console.log("🟢 RESPONSE: cardUpdated response sent successfully");
      } catch (error) {
        console.error(
          "🟢 CRITICAL ERROR: Failed to send cardUpdated response:",
          error
        );
      }
      return;
    }

    // For other message types, use the standard approach
    this.webview.postMessage(message);
  }

  // Helper method for sanitizing strings (Suggestion 7)
  private sanitizeString(str: string, maxLength: number): string {
    if (!str) {
      return "";
    }
    // Trim the string to max length and sanitize special characters if needed
    return str.slice(0, maxLength);
  }

  // Note on performance considerations (Suggestion 6):
  // For larger datasets, consider implementing individual board storage with keys like:
  // - "boogie.board.<id>" instead of loading all boards at once
  // - This would improve performance for operations that only need a single board

  // Implement new handler methods for column operations
  private async handleAddColumn(message: AddColumnMessage): Promise<void> {
    // Input validation
    if (!message.data?.boardId || !message.data?.column) {
      this.sendMessage({
        command: "columnAdded",
        data: {
          success: false,
          error: "Missing required fields: boardId or column data",
        },
      } as ColumnResponse);
      return;
    }

    // Sanitize column data
    const sanitizedColumn: Column = {
      id: message.data.column.id,
      title: this.sanitizeString(message.data.column.title, 100),
      cards: [], // Start with empty cards array
    };

    const boards = this.getBoards();
    const targetBoard = boards.find((b) => b.id === message.data.boardId);

    if (targetBoard) {
      // Check if column with same ID already exists
      const existingColumnIndex = targetBoard.columns.findIndex(
        (c) => c.id === sanitizedColumn.id
      );

      if (existingColumnIndex !== -1) {
        this.sendMessage({
          command: "columnAdded",
          data: {
            success: false,
            error: `Column with ID '${sanitizedColumn.id}' already exists in this board.`,
          },
        } as ColumnResponse);
        return;
      }

      // Add new column
      targetBoard.columns.push(sanitizedColumn);
      targetBoard.updatedAt = new Date().toISOString();
      await this.saveBoards(boards);

      this.logger.info(
        `Column added to board ${targetBoard.id}:`,
        sanitizedColumn
      );

      this.sendMessage({
        command: "columnAdded",
        data: {
          success: true,
          column: sanitizedColumn,
          boardId: message.data.boardId,
        },
      } as ColumnResponse);
    } else {
      this.sendMessage({
        command: "columnAdded",
        data: {
          success: false,
          error: `Board with ID '${message.data.boardId}' not found.`,
        },
      } as ColumnResponse);
    }
  }

  private async handleUpdateColumn(
    message: UpdateColumnMessage
  ): Promise<void> {
    // Input validation
    if (
      !message.data?.boardId ||
      !message.data?.column ||
      !message.data.column.id
    ) {
      this.sendMessage({
        command: "columnUpdated",
        data: {
          success: false,
          error: "Missing required fields: boardId, column, or column.id",
        },
      } as ColumnResponse);
      return;
    }

    // Sanitize column data
    const sanitizedColumn: Column = {
      id: message.data.column.id,
      title: this.sanitizeString(message.data.column.title, 100),
      cards: message.data.column.cards || [], // Preserve existing cards
    };

    const boards = this.getBoards();
    const targetBoard = boards.find((b) => b.id === message.data.boardId);

    if (targetBoard) {
      const columnIndex = targetBoard.columns.findIndex(
        (c) => c.id === sanitizedColumn.id
      );

      if (columnIndex !== -1) {
        // Preserve the cards from the existing column
        const existingCards = targetBoard.columns[columnIndex].cards;
        sanitizedColumn.cards = existingCards;

        // Update the column
        targetBoard.columns[columnIndex] = sanitizedColumn;
        targetBoard.updatedAt = new Date().toISOString();
        await this.saveBoards(boards);

        this.logger.info(
          `Column updated in board ${targetBoard.id}:`,
          sanitizedColumn
        );

        this.sendMessage({
          command: "columnUpdated",
          data: {
            success: true,
            column: sanitizedColumn,
            boardId: message.data.boardId,
          },
        } as ColumnResponse);
      } else {
        this.sendMessage({
          command: "columnUpdated",
          data: {
            success: false,
            error: `Column with ID '${sanitizedColumn.id}' not found in board '${targetBoard.title}'.`,
          },
        } as ColumnResponse);
      }
    } else {
      this.sendMessage({
        command: "columnUpdated",
        data: {
          success: false,
          error: `Board with ID '${message.data.boardId}' not found.`,
        },
      } as ColumnResponse);
    }
  }

  private async handleDeleteColumn(
    message: DeleteColumnMessage
  ): Promise<void> {
    // Input validation
    if (!message.data?.boardId || !message.data?.columnId) {
      this.sendMessage({
        command: "columnDeleted",
        data: {
          success: false,
          error: "Missing required fields: boardId or columnId",
        },
      } as ColumnDeletedResponse);
      return;
    }

    const boards = this.getBoards();
    const targetBoard = boards.find((b) => b.id === message.data.boardId);

    if (targetBoard) {
      // Check if this is the last column in the board
      if (targetBoard.columns.length <= 1) {
        this.sendMessage({
          command: "columnDeleted",
          data: {
            success: false,
            error: "Cannot delete the last column in a board.",
          },
        } as ColumnDeletedResponse);
        return;
      }

      const columnIndex = targetBoard.columns.findIndex(
        (c) => c.id === message.data.columnId
      );

      if (columnIndex !== -1) {
        // Get deleted column info for logging
        const deletedColumn = targetBoard.columns[columnIndex];
        const cardCount = deletedColumn.cards.length;

        // Remove the column
        targetBoard.columns.splice(columnIndex, 1);
        targetBoard.updatedAt = new Date().toISOString();
        await this.saveBoards(boards);

        this.logger.info(
          `Column deleted from board ${targetBoard.id}: ${deletedColumn.title} (contained ${cardCount} cards)`
        );

        this.sendMessage({
          command: "columnDeleted",
          data: {
            success: true,
            columnId: message.data.columnId,
            boardId: message.data.boardId,
          },
        } as ColumnDeletedResponse);
      } else {
        this.sendMessage({
          command: "columnDeleted",
          data: {
            success: false,
            error: `Column with ID '${message.data.columnId}' not found in board '${targetBoard.title}'.`,
          },
        } as ColumnDeletedResponse);
      }
    } else {
      this.sendMessage({
        command: "columnDeleted",
        data: {
          success: false,
          error: `Board with ID '${message.data.boardId}' not found.`,
        },
      } as ColumnDeletedResponse);
    }
  }
}
