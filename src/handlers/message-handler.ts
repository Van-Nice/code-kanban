import * as vscode from "vscode";
import {
  WebviewMessage,
  ResponseMessage,
  WebviewResponse,
  LogMessage,
  ErrorMessage,
} from "./messages";
import { Logger } from "./logger";
import { BoardStorage } from "./board/board-storage";

export interface HandlerContext {
  storage: BoardStorage;
  logger: Logger;
  webviewContext: string;
  webview: vscode.Webview;
  vscodeContext: vscode.ExtensionContext;
}

export interface HandlerFunction<T> {
  (message: T, context: HandlerContext): Promise<WebviewResponse | void>;
}

export abstract class MessageHandlerBase<T, R extends WebviewResponse> {
  abstract handle(message: T, context: HandlerContext): Promise<R>;
}

export class MessageHandler {
  private webview: vscode.Webview;
  private context: vscode.ExtensionContext;
  private webviewContext: string;
  private logger: Logger;
  private storage: BoardStorage;

  constructor(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    webviewContext: string = "sidebar"
  ) {
    this.webview = webview;
    this.context = context;
    this.webviewContext = webviewContext;
    this.logger = new Logger({
      debug:
        process.env.NODE_ENV === "development" ||
        Boolean(process.env.DEBUG === "true"),
    });
    this.storage = new BoardStorage(context);
  }

  public async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      this.logger.debug("Received message from webview:", message);
      this.logger.info("Webview context:", this.webviewContext);

      if (!message || !message.command) {
        throw new Error("Invalid message: missing command");
      }

      const handlerContext: HandlerContext = {
        storage: this.storage,
        logger: this.logger,
        webviewContext: this.webviewContext,
        webview: this.webview,
        vscodeContext: this.context,
      };

      const handlers = require(".");
      const handler = handlerMap[message.command];
      if (handler) {
        const response = await handler(message as any, handlerContext);
        if (response) {
          this.sendMessage(response as any);
        }
      } else {
        this.logger.error(`Unknown command: ${message.command}`);
      }
    } catch (error) {
      this.logger.error("Unexpected error in handleMessage:", error);
      const responseCommand =
        message && message.command
          ? `${message.command}Failed`
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

  public sendMessage(message: ResponseMessage | WebviewMessage): void {
    if (message.command === "cardUpdated") {
      const cardResponse = message as any;
      console.log(
        "🟢 RESPONSE: Sending cardUpdated response to webview:",
        JSON.stringify(cardResponse.data, null, 2)
      );
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
    } else if (message.command === "columnDeleted") {
      const columnResponse = message as any;
      console.log(
        "🟢 RESPONSE: Sending columnDeleted response to webview:",
        JSON.stringify(columnResponse.data, null, 2)
      );
      const sendTime = new Date().toISOString();
      console.log(`🟢 RESPONSE: Timestamp ${sendTime}`);
      try {
        this.webview.postMessage(message);
        console.log("🟢 RESPONSE: columnDeleted response sent successfully");
      } catch (error) {
        console.error(
          "🟢 CRITICAL ERROR: Failed to send columnDeleted response:",
          error
        );
      }
      return;
    }
    this.webview.postMessage(message);
  }
}

import * as handlers from ".";

const handlerMap: { [command: string]: HandlerFunction<any> } = {
  log: handlers.handleLog,
  error: handlers.handleError,
  getBoards: handlers.handleGetBoards,
  getBoard: handlers.handleGetBoard,
  createBoard: handlers.handleCreateBoard,
  deleteBoard: handlers.handleDeleteBoard,
  updateBoard: handlers.handleUpdateBoard,
  boardLoaded: handlers.handleBoardLoaded,
  addCard: handlers.handleAddCard,
  updateCard: handlers.handleUpdateCard,
  deleteCard: handlers.handleDeleteCard,
  moveCard: handlers.handleMoveCard,
  addColumn: handlers.handleAddColumn,
  updateColumn: handlers.handleUpdateColumn,
  deleteColumn: handlers.handleDeleteColumn,
  openBoardInEditor: handlers.handleOpenBoardInEditor,
  showErrorMessage: handlers.handleShowErrorMessage,
};
