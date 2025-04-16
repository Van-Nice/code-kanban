import * as vscode from "vscode";
import {
  WebviewMessage,
  ResponseMessage,
  WebviewResponse,
  LogMessage,
  ErrorMessage,
  ShowErrorMessageMessage,
} from "./messages";
import { Logger } from "./logger";
import { BoardStorage } from "./board/board-storage";
import { Commands } from "../shared/commands";
import { directAddCard } from "./direct-add-card";
import * as handlers from ".";
import { handleAddCard } from "./card/add-card-handler";
import { handleUpdateCard } from "./card/update-card-handler";
import { handleDeleteCard } from "./card/delete-card-handler";
import { handleMoveCard } from "./card/move-card-handler";
import { handleAddColumn } from "./column/add-column-handler";
import { handleUpdateColumn } from "./column/update-column-handler";
import { handleDeleteColumn } from "./column/delete-column-handler";
import { handleGetBoards } from "./board/get-boards-handler";
import { handleGetBoard } from "./board/get-board-handler";
import { handleCreateBoard } from "./board/create-board-handler";
import { handleDeleteBoard } from "./board/delete-board-handler";
import { handleOpenBoardInEditor } from "./board/open-board-in-editor-handler";
import { handleBoardLoaded } from "./board/board-loaded-handler";
import { handleSetColumnCollapsedState } from "./column/set-column-state-handler";

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
    storage: BoardStorage,
    webviewContext: string = "sidebar"
  ) {
    this.webview = webview;
    this.context = context;
    this.storage = storage;
    this.webviewContext = webviewContext;
    this.logger = new Logger({
      debug:
        process.env.NODE_ENV === "development" ||
        Boolean(process.env.DEBUG === "true"),
    });
  }

  public async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      console.log("📨 Raw message received:", JSON.stringify(message, null, 2));

      // Special detection for add card operation
      if (
        message &&
        (message.command === "addCard" || message.command === Commands.ADD_CARD)
      ) {
        console.log("⭐⭐⭐ ADD CARD COMMAND DETECTED IN FIRST STAGE");
        console.log("Message command type:", typeof message.command);
        console.log("Message command value:", message.command);
        console.log(
          "Message data:",
          JSON.stringify((message as any).data, null, 2)
        );
      }

      console.log("📨 Received message:", JSON.stringify(message, null, 2));

      // Add debug logging for addCard messages
      if (message.command === "addCard") {
        console.log("🎯🎯🎯 ADD CARD MESSAGE RECEIVED IN HANDLER");
        console.log("🎯 Message command:", message.command);
        console.log(
          "🎯 Message data:",
          JSON.stringify((message as any).data, null, 2)
        );
      }

      const handlerContext: HandlerContext = {
        storage: this.storage,
        logger: this.logger,
        webviewContext: this.webviewContext,
        webview: this.webview,
        vscodeContext: this.context,
      };

      // Get the handler for this command
      const handler = handlerMap[message.command];

      // Log handler existence
      console.log(`🔍 Looking for handler for command: ${message.command}`);
      console.log(`🔍 Handler exists? ${!!handler}`);
      console.log(`🔍 HandlerMap keys: ${Object.keys(handlerMap).join(", ")}`);

      // Add debug logging for addCard handler
      if (message.command === "addCard") {
        console.log("🎯 HandlerMap keys:", Object.keys(handlerMap));
        console.log("🎯 Commands.ADD_CARD value:", Commands.ADD_CARD);
        console.log("🎯 Handler found:", !!handler);
        console.log("🎯 Handler type:", handler ? typeof handler : "undefined");
      }

      if (handler) {
        console.log(`✅ Found handler for command: ${message.command}`);

        if (message.command === "addCard") {
          console.log("🎯 About to execute addCard handler");
        }

        const response = await handler(message as any, handlerContext);

        if (message.command === "addCard") {
          console.log("🎯 AddCard handler executed");
          console.log(
            "🎯 Response:",
            response ? JSON.stringify(response, null, 2) : "No response"
          );
        }

        if (response) {
          console.log(
            `✅ Handler returned response for ${message.command}:`,
            response.command
          );
          this.sendMessage(response as any);
        } else {
          console.log(
            `❌ Handler did not return a response for ${message.command}`
          );
        }
      } else {
        console.log(`❌ No handler found for command: ${message.command}`);

        // Special case for addCard - try to use the handler directly if command string doesn't match
        if (message.command === "addCard" && handlers.handleAddCard) {
          console.log("🔄 Using direct addCard handler as fallback");
          try {
            const response = await handlers.handleAddCard(
              message as any,
              handlerContext
            );
            if (response) {
              console.log("✅ Direct addCard handler executed successfully");
              this.sendMessage(response as any);
            }
          } catch (err) {
            console.error("❌ Error in direct addCard handler:", err);
          }
        } else {
          this.logger.error(`Unknown command: ${message.command}`);
        }
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
      case Commands.CARD_ADDED:
        console.log(
          "🟢 RESPONSE: Sending cardAdded response to webview:",
          JSON.stringify(message, null, 2)
        );
        const cardAddedSendTime = new Date().toISOString();
        console.log(`🟢 RESPONSE: CARD_ADDED Timestamp ${cardAddedSendTime}`);
        try {
          console.log("🟢 RESPONSE: Attempting to post CARD_ADDED message");
          this.webview.postMessage(message);
          const cardAddedResponse = message as any;
          console.log(
            `🟢 RESPONSE: CARD_ADDED response sent successfully with data:`,
            JSON.stringify(
              {
                success: cardAddedResponse.data?.success,
                cardId: cardAddedResponse.data?.card?.id,
                columnId: cardAddedResponse.data?.columnId,
                boardId: cardAddedResponse.data?.boardId,
              },
              null,
              2
            )
          );
        } catch (error) {
          console.error(
            "🟢 CRITICAL ERROR: Failed to send cardAdded response:",
            error
          );
        }
        break;
      case Commands.COLUMN_UPDATED:
        console.log(
          "🟢 RESPONSE: Sending columnUpdated response to webview:",
          JSON.stringify(message, null, 2)
        );
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

// Add a handler for executeCommand
export async function handleExecuteCommand(
  message: any,
  context: HandlerContext
): Promise<void> {
  try {
    const { command, args } = message.data || {};

    console.log(`🎮 Executing command: ${command} with args:`, args);

    if (!command) {
      console.error("🎮 No command provided for execution");
      return;
    }

    // Execute the command with the provided arguments
    const result = await vscode.commands.executeCommand(
      command,
      ...(args || [])
    );

    console.log(`🎮 Command execution result:`, result);
  } catch (error) {
    console.error("🎮 Error executing command:", error);
  }
}

const handlerMap: Record<
  string,
  (message: any, context: HandlerContext) => Promise<WebviewResponse | void>
> = {
  [Commands.GET_BOARDS]: handleGetBoards,
  [Commands.GET_BOARD]: handleGetBoard,
  [Commands.CREATE_BOARD]: handleCreateBoard,
  [Commands.DELETE_BOARD]: handleDeleteBoard,
  [Commands.OPEN_BOARD_IN_EDITOR]: handleOpenBoardInEditor,
  boardLoaded: handleBoardLoaded,

  [Commands.ADD_COLUMN]: handleAddColumn,
  [Commands.UPDATE_COLUMN]: handleUpdateColumn,
  [Commands.DELETE_COLUMN]: handleDeleteColumn,
  // Column state
  [Commands.SET_COLUMN_COLLAPSED_STATE]: handleSetColumnCollapsedState,

  // Use Command constants for Card operations
  [Commands.ADD_CARD]: handleAddCard,
  [Commands.UPDATE_CARD]: handleUpdateCard,
  [Commands.DELETE_CARD]: handleDeleteCard,
  [Commands.MOVE_CARD]: handleMoveCard,

  // Utility/other commands (Ensure handlers exist or are implemented)
  log: async (message: LogMessage, context: HandlerContext) => {
    context.logger.debug(message.data.message, message.data.data);
  },
  error: async (message: ErrorMessage, context: HandlerContext) => {
    context.logger.error(message.data.message, message.data.error);
  },
  showErrorMessage: async (
    message: ShowErrorMessageMessage,
    _context: HandlerContext
  ) => {
    vscode.window.showErrorMessage(message.data.message);
  },
  executeCommand: handleExecuteCommand,
  // Add other handlers as needed
};
