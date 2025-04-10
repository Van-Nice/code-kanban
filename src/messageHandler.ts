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
    await this.context.globalState.update(BOARDS_STORAGE_KEY, boards);
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
    // Input validation (Suggestion 2, 7)
    if (
      !message.data?.boardId ||
      !message.data?.columnId ||
      !message.data?.card
    ) {
      this.sendMessage({
        command: "cardAdded",
        data: {
          success: false,
          error: "Missing required fields: boardId, columnId, or card data",
        },
      } as CardResponse);
      return;
    }

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

    const boardsForAdd = this.getBoards();
    const targetBoard = boardsForAdd.find((b) => b.id === message.data.boardId);

    if (targetBoard) {
      const column = targetBoard.columns.find(
        (c) => c.id === message.data.columnId
      );

      if (column) {
        column.cards.push(sanitizedCard);
        targetBoard.updatedAt = new Date().toISOString();
        await this.saveBoards(boardsForAdd);

        this.sendMessage({
          command: "cardAdded",
          data: {
            success: true,
            card: sanitizedCard,
            columnId: message.data.columnId,
          },
        } as CardResponse);
      } else {
        // Enhanced error message (Suggestion 8)
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

      const boardsForUpdate = this.getBoards();
      this.logger.debug("Boards retrieved:", boardsForUpdate.length);

      const boardToUpdate = boardsForUpdate.find(
        (b) => b.id === message.data.boardId
      );

      if (!boardToUpdate) {
        throw new Error(`Board with ID '${message.data.boardId}' not found`);
      }

      this.logger.debug("Found board to update:", boardToUpdate.title);

      const columnToUpdate = boardToUpdate.columns.find(
        (c) => c.id === message.data.columnId
      );

      if (!columnToUpdate) {
        throw new Error(
          `Column with ID '${message.data.columnId}' not found in board '${boardToUpdate.title}'`
        );
      }

      this.logger.debug("Found column to update:", columnToUpdate.title);
      this.logger.debug("Column has cards:", columnToUpdate.cards.length);

      const cardIndex = columnToUpdate.cards.findIndex(
        (c) => c.id === sanitizedCard.id
      );

      this.logger.debug(
        `Card index: ${cardIndex}, Card ID: ${sanitizedCard.id}`
      );

      if (cardIndex === -1) {
        throw new Error(
          `Card with ID '${sanitizedCard.id}' not found in column '${columnToUpdate.title}'`
        );
      }

      columnToUpdate.cards[cardIndex] = sanitizedCard;
      boardToUpdate.updatedAt = new Date().toISOString();
      await this.saveBoards(boardsForUpdate);

      // Log detailed card update information
      console.log(`[CARD UPDATE] Details of updated card:`);
      console.log(
        `- Original title: "${columnToUpdate.cards[cardIndex].title}"`
      );
      console.log(`- Updated title: "${sanitizedCard.title}"`);
      console.log(`- Card ID: ${sanitizedCard.id}`);
      console.log(
        `- Column: ${columnToUpdate.title} (${message.data.columnId})`
      );
      console.log(`- Board: ${boardToUpdate.title} (${message.data.boardId})`);

      // Use direct console.log instead of logger.info to avoid linter issues
      console.log(
        `[INFO] Card updated successfully: ${sanitizedCard.id} in column ${message.data.columnId}`
      );

      this.sendMessage({
        command: "cardUpdated",
        data: {
          success: true,
          card: sanitizedCard,
          columnId: message.data.columnId,
        },
      } as CardResponse);
    } catch (error) {
      // Enhanced error handling (Suggestion 1, 8)
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
          toColumn.cards.push(card);
          boardForMove.updatedAt = new Date().toISOString();
          await this.saveBoards(boardsForMove);

          this.sendMessage({
            command: "cardMoved",
            data: {
              success: true,
              cardId: message.data.cardId,
              fromColumnId: message.data.fromColumnId,
              toColumnId: message.data.toColumnId,
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
}
