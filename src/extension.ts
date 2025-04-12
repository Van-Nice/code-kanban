import * as vscode from "vscode";
import * as path from "path";
import { MessageHandler } from "./handlers/message-handler";
import { Commands } from "./shared/commands";

// Using context for extension-wide data, not global messageHandler
let extensionContext: vscode.ExtensionContext;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  // Variable to store sidebar state (e.g., current board ID)
  let sidebarState: { boardId: string | null } = { boardId: null };

  // Set up webview
  extensionContext.subscriptions.push(
    vscode.window.registerWebviewViewProvider("boogieWebview", {
      resolveWebviewView(webviewView: vscode.WebviewView) {
        // Enable scripts and set resource roots
        webviewView.webview.options = {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(extensionContext.extensionPath, "dist")),
          ],
        };

        // Get the path to the compiled webview.js and convert it to a webview URI
        const webviewJsPath = vscode.Uri.file(
          path.join(extensionContext.extensionPath, "dist", "webview.js")
        );
        const webviewJsUri = webviewView.webview.asWebviewUri(webviewJsPath);

        // Get the path to the CSS file
        const webviewCssPath = vscode.Uri.file(
          path.join(extensionContext.extensionPath, "dist", "webview.css")
        );
        const webviewCssUri = webviewView.webview.asWebviewUri(webviewCssPath);

        // Initialize the message handler with sidebar context - instance specific
        const messageHandler = new MessageHandler(
          webviewView.webview,
          extensionContext,
          "sidebar"
        );

        webviewView.onDidChangeVisibility(() => {
          if (!webviewView.visible) {
            // Request state from webview when it becomes hidden - REMOVED as it's ineffective
            // console.log("Sidebar hidden, requesting state...");
            // webviewView.webview.postMessage({ command: "getState" });
          } else {
            // Restore state when it becomes visible if we have saved state
            console.log("Sidebar visible, restoring state:", sidebarState);
            // Use a slight delay to ensure the webview is ready to receive messages after being recreated
            setTimeout(() => {
              if (webviewView.visible && sidebarState) {
                // Check visibility again in case it changed quickly
                webviewView.webview.postMessage({
                  command: "setState",
                  data: sidebarState, // Send { boardId: string | null }
                });
              }
            }, 100); // 100ms delay, adjust if needed
          }
        });

        // Set up message listener
        webviewView.webview.onDidReceiveMessage(
          async (message) => {
            // Reference to the webview for sending back messages
            const webview = webviewView.webview;
            // Local function to handle message processing and state saving
            const processMessage = async (msg: any) => {
              // Debug logging for ALL incoming messages
              console.log(
                `>>> SIDEBAR LISTENER: Received raw message:`,
                JSON.stringify(msg, null, 2)
              );
              console.log(`Sidebar received message: ${msg.command}`);

              // Handle state persistence messages FIRST
              if (msg.command === "getStateResponse") {
                // This case might be obsolete now, but keep for safety/debugging
                console.log(
                  "Extension received sidebar state (getStateResponse):",
                  msg.data
                );
                if (msg.data && typeof msg.data.boardId !== "undefined") {
                  sidebarState = msg.data;
                }
                return;
              }

              if (msg.command === "requestInitialState") {
                console.log(
                  "Webview requested initial state. Sending:",
                  sidebarState
                );
                // Send state immediately on request
                webview.postMessage({
                  command: "setState",
                  data: sidebarState,
                });
                return;
              }

              // Original message handling logic using messageHandler
              try {
                // Determine if the handler will potentially load a board
                const isBoardLoadCommand = msg.command === Commands.GET_BOARD;
                let boardIdBeforeHandling = sidebarState?.boardId; // Store current state

                // Process the message using the existing handler
                await messageHandler.handleMessage(msg);

                // --- Proactive State Saving ---
                // After handling, check if the state needs updating based on the command
                if (msg.command === Commands.GET_BOARD && msg.data?.boardId) {
                  // If GET_BOARD was processed, assume success for now means we update state
                  // A more robust way would be to check the response from handleMessage if it indicated success
                  const newBoardId = msg.data.boardId;
                  if (sidebarState?.boardId !== newBoardId) {
                    console.log(
                      `SIDEBAR: Proactively saving board state: ${newBoardId}`
                    );
                    sidebarState = { boardId: newBoardId };
                  }
                } else if (msg.command === "handleBackToBoards") {
                  // Example: If webview signals going back to list
                  if (sidebarState?.boardId !== null) {
                    console.log(
                      `SIDEBAR: Proactively clearing board state (back to list)`
                    );
                    sidebarState = { boardId: null };
                  }
                }
                // Add more else if conditions here for other commands that change the current board
                // e.g., if a board is deleted, set sidebarState.boardId = null
                // -------------------------------
              } catch (error) {
                console.error(
                  `SIDEBAR: Error handling message ${msg.command}:`,
                  error
                );
              }
            };

            // Call the processing function
            await processMessage(message);
          },
          undefined,
          extensionContext.subscriptions
        );

        // Add a listener for disposal (optional but good for debugging)
        webviewView.onDidDispose(() => {
          console.log("Sidebar webview disposed");
          // Clear state or perform other cleanup if necessary
          // sidebarState = { boardId: null }; // Might reset state unintentionally if just hidden
        });

        // Set the HTML content with js and css embedded for the webview view
        webviewView.webview.html = `
					<!DOCTYPE html>
					<html lang="en">
					<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<link href="${webviewCssUri}" rel="stylesheet">
						<title>Kanban Board</title>
					</head>
					<body>
						<div id="app"></div>
						<script>
							window.webviewContext = "sidebar";
						</script>
						<script src="${webviewJsUri}"></script>
					</body>
					</html>
				`;
      },
    })
  );

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "boogie" is now active!');

  // Register command to open the Kanban board
  const disposable = vscode.commands.registerCommand(
    "boogie.openKanbanBoard",
    () => {
      // Create a new webview panel
      const panel = vscode.window.createWebviewPanel(
        "kanbanBoard",
        "Kanban Board",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(extensionContext.extensionPath, "dist")),
          ],
        }
      );

      // Initialize message handler with editor context - instance specific
      const messageHandler = new MessageHandler(
        panel.webview,
        extensionContext,
        "editor"
      );

      // Set up message listener
      panel.webview.onDidReceiveMessage(
        async (message) => {
          // Debug logging for ALL incoming messages
          console.log(
            `>>> EDITOR LISTENER: Received raw message:`,
            JSON.stringify(message, null, 2)
          );
          console.log(`Editor received message: ${message.command}`);

          // Handle executeCommand messages
          if (message.command === "executeCommand" && message.commandId) {
            console.log(
              `🔍 EDITOR: Executing command ${message.commandId} with args:`,
              message.args
            );

            try {
              // Execute the command directly
              await vscode.commands.executeCommand(
                message.commandId,
                ...message.args
              );
              console.log(
                `🔍 EDITOR: Successfully executed command ${message.commandId}`
              );
            } catch (error) {
              console.error(
                `🔍 EDITOR: Error executing command ${message.commandId}:`,
                error
              );
            }
            return;
          }

          if (message.command === "updateCard") {
            console.log(
              "Extension received updateCard message:",
              JSON.stringify(message.data, null, 2)
            );
          }
          await messageHandler.handleMessage(message);
        },
        undefined,
        extensionContext.subscriptions
      );

      // Get the path to the compiled webview.js and convert it to a webview URI
      const webviewJsPath = vscode.Uri.file(
        path.join(extensionContext.extensionPath, "dist", "webview.js")
      );
      const webviewJsUri = panel.webview.asWebviewUri(webviewJsPath);

      // Get the path to the CSS file
      const webviewCssPath = vscode.Uri.file(
        path.join(extensionContext.extensionPath, "dist", "webview.css")
      );
      const webviewCssUri = panel.webview.asWebviewUri(webviewCssPath);

      // Set the HTML content
      panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${webviewCssUri}" rel="stylesheet">
          <title>Kanban Board</title>
        </head>
        <body>
          <div id="app"></div>
          <script>
            window.webviewContext = "editor";
          </script>
          <script src="${webviewJsUri}"></script>
        </body>
        </html>
      `;
    }
  );

  // Register command to open a specific board in the editor
  const openBoardInEditorDisposable = vscode.commands.registerCommand(
    "boogie.openBoardInEditor",
    (boardId: string) => {
      // Create a new webview panel
      const panel = vscode.window.createWebviewPanel(
        "kanbanBoard",
        "Kanban Board",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(extensionContext.extensionPath, "dist")),
          ],
        }
      );

      // Initialize message handler with editor context - instance specific
      const messageHandler = new MessageHandler(
        panel.webview,
        extensionContext,
        "editor"
      );

      // Set up message listener
      panel.webview.onDidReceiveMessage(
        async (message) => {
          // Debug logging for ALL incoming messages
          console.log(
            `>>> BOARD EDITOR LISTENER: Received raw message:`,
            JSON.stringify(message, null, 2)
          );
          console.log(`Board editor received message: ${message.command}`);

          // Handle executeCommand messages
          if (message.command === "executeCommand" && message.commandId) {
            console.log(
              `🔍 BOARD EDITOR: Executing command ${message.commandId} with args:`,
              message.args
            );

            try {
              // Execute the command directly
              await vscode.commands.executeCommand(
                message.commandId,
                ...message.args
              );
              console.log(
                `🔍 BOARD EDITOR: Successfully executed command ${message.commandId}`
              );
            } catch (error) {
              console.error(
                `🔍 BOARD EDITOR: Error executing command ${message.commandId}:`,
                error
              );
            }
            return;
          }

          if (message.command === "updateCard") {
            console.log(
              "Extension received updateCard message:",
              JSON.stringify(message.data, null, 2)
            );
          }
          await messageHandler.handleMessage(message);
        },
        undefined,
        extensionContext.subscriptions
      );

      // Get the path to the compiled webview.js and convert it to a webview URI
      const webviewJsPath = vscode.Uri.file(
        path.join(extensionContext.extensionPath, "dist", "webview.js")
      );
      const webviewJsUri = panel.webview.asWebviewUri(webviewJsPath);

      // Get the path to the CSS file
      const webviewCssPath = vscode.Uri.file(
        path.join(extensionContext.extensionPath, "dist", "webview.css")
      );
      const webviewCssUri = panel.webview.asWebviewUri(webviewCssPath);

      // Set the HTML content with boardId in the URL
      panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${webviewCssUri}" rel="stylesheet">
          <title>Kanban Board</title>
        </head>
        <body>
          <div id="app"></div>
          <script>
            window.boardId = "${boardId}";
            window.webviewContext = "editor";
          </script>
          <script src="${webviewJsUri}"></script>
        </body>
        </html>
      `;
    }
  );

  extensionContext.subscriptions.push(disposable, openBoardInEditorDisposable);

  // Register a direct command to add a card (accessible to all parts of the extension)
  const directAddCardDisposable = vscode.commands.registerCommand(
    "boogie.directAddCard",
    async (
      title: string,
      columnId: string,
      boardId: string,
      description?: string,
      labels?: string[],
      assignee?: string
    ) => {
      console.log("🎯 Direct add card command called with:", {
        title,
        columnId,
        boardId,
        description,
        labels,
        assignee,
      });

      try {
        // Create the storage directly
        const { BoardStorage } = require("./handlers/board/board-storage");
        const { v4: uuidv4 } = require("uuid");
        const storage = new BoardStorage(context);

        // Validate parameters
        if (!title || !columnId || !boardId) {
          console.error("🎯 DIRECT ADD CARD: Missing required fields");
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

        console.log("🎯 DIRECT ADD CARD: Saving card:", newCard);

        // Save the card directly
        await storage.saveCard(newCard);

        console.log("🎯 DIRECT ADD CARD: Card saved successfully!");

        // Show a notification
        vscode.window.showInformationMessage(
          `Card "${title}" created successfully!`
        );

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
  );

  extensionContext.subscriptions.push(directAddCardDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
