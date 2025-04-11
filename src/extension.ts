import * as vscode from "vscode";
import * as path from "path";
import { MessageHandler } from "./handlers/message-handler";

// Using context for extension-wide data, not global messageHandler
let extensionContext: vscode.ExtensionContext;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

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

        // Set up message listener
        webviewView.webview.onDidReceiveMessage(
          async (message) => {
            // Debug logging for ALL incoming messages
            console.log(
              `>>> SIDEBAR LISTENER: Received raw message:`,
              JSON.stringify(message, null, 2)
            );
            console.log(`Sidebar received message: ${message.command}`);

            // Handle executeCommand messages
            if (message.command === "executeCommand" && message.commandId) {
              console.log(
                `🔍 SIDEBAR: Executing command ${message.commandId} with args:`,
                message.args
              );

              try {
                // Execute the command directly
                await vscode.commands.executeCommand(
                  message.commandId,
                  ...message.args
                );
                console.log(
                  `🔍 SIDEBAR: Successfully executed command ${message.commandId}`
                );
              } catch (error) {
                console.error(
                  `🔍 SIDEBAR: Error executing command ${message.commandId}:`,
                  error
                );
              }
              return;
            }

            // Special case for addCardDirect command - bypass regular handling
            if (message.command === "addCardDirect") {
              console.log("🔴 DIRECT CARD CREATION REQUEST RECEIVED");
              console.log(
                "🔴 Card data:",
                JSON.stringify(message.data, null, 2)
              );

              try {
                // Create a modified message that matches what handleAddCard expects
                const addCardMessage = {
                  command: "addCard",
                  data: message.data,
                };

                console.log(
                  "🔴 Converting to standard addCard message:",
                  JSON.stringify(addCardMessage, null, 2)
                );

                // Process with the message handler
                await messageHandler.handleMessage(addCardMessage);
                console.log("🔴 Direct card creation processed successfully");
              } catch (error) {
                console.error("🔴 Error in direct card creation:", error);
              }
              return;
            }

            if (
              message.command === "updateCard" ||
              message.command === "addCard"
            ) {
              console.log(
                `⭐⭐⭐ CRITICAL ${message.command.toUpperCase()} MESSAGE RECEIVED IN SIDEBAR - Details:`,
                JSON.stringify(message.data, null, 2)
              );

              // Extra logging for card messages
              console.log(
                `⭐ CRITICAL ${message.command.toUpperCase()} MESSAGE - Card Properties:`
              );
              if (message.command === "updateCard") {
                console.log(`- Card ID: ${message.data?.card?.id}`);
                console.log(`- Card Title: "${message.data?.card?.title}"`);
              } else {
                console.log(`- Title: "${message.data?.title}"`);
              }
              console.log(`- Column ID: ${message.data?.columnId}`);
              console.log(`- Board ID: ${message.data?.boardId}`);

              try {
                await messageHandler.handleMessage(message);
                console.log(
                  `⭐ CRITICAL ${message.command.toUpperCase()} MESSAGE - Handler completed successfully`
                );
              } catch (error) {
                console.error(
                  `⭐ CRITICAL ${message.command.toUpperCase()} MESSAGE - Handler failed with error:`,
                  error
                );
              }
            } else {
              await messageHandler.handleMessage(message);
            }
          },
          undefined,
          extensionContext.subscriptions
        );

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
