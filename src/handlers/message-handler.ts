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
import { Commands } from "../shared/commands";

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
    // Track command-specific metrics and add enhanced logging
    switch (message.command) {
      case Commands.CARD_UPDATED:
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
        break;
      case Commands.COLUMN_DELETED:
        console.log(
          "🟢 RESPONSE: Sending columnDeleted response to webview:",
          JSON.stringify(message, null, 2)
        );
        break;
      default:
      // No special action needed
    }

    // Always send the message
    this.webview.postMessage(message);
  }
}

import * as handlers from ".";

const handlerMap: { [command: string]: HandlerFunction<any> } = {
  [Commands.LOG]: handlers.handleLog,
  [Commands.ERROR]: handlers.handleError,
  [Commands.GET_BOARDS]: handlers.handleGetBoards,
  [Commands.GET_BOARD]: handlers.handleGetBoard,
  [Commands.CREATE_BOARD]: handlers.handleCreateBoard,
  [Commands.DELETE_BOARD]: handlers.handleDeleteBoard,
  [Commands.UPDATE_BOARD]: handlers.handleUpdateBoard,
  [Commands.BOARD_LOADED]: handlers.handleBoardLoaded,
  [Commands.ADD_CARD]: handlers.handleAddCard,
  [Commands.UPDATE_CARD]: handlers.handleUpdateCard,
  [Commands.DELETE_CARD]: handlers.handleDeleteCard,
  [Commands.MOVE_CARD]: handlers.handleMoveCard,
  [Commands.ADD_COLUMN]: handlers.handleAddColumn,
  [Commands.UPDATE_COLUMN]: handlers.handleUpdateColumn,
  [Commands.DELETE_COLUMN]: handlers.handleDeleteColumn,
  [Commands.OPEN_BOARD_IN_EDITOR]: handlers.handleOpenBoardInEditor,
  [Commands.SHOW_ERROR_MESSAGE]: handlers.handleShowErrorMessage,
};
