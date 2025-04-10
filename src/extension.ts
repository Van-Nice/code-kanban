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
            console.log(`Sidebar received message: ${message.command}`);
            if (message.command === "updateCard") {
              console.log(
                "⭐⭐⭐ CRITICAL UPDATE MESSAGE RECEIVED IN SIDEBAR - Details:",
                JSON.stringify(message.data, null, 2)
              );

              // Extra logging for updateCard messages
              console.log("⭐ CRITICAL UPDATE MESSAGE - Card Properties:");
              console.log(`- Card ID: ${message.data?.card?.id}`);
              console.log(`- Card Title: "${message.data?.card?.title}"`);
              console.log(`- Column ID: ${message.data?.columnId}`);
              console.log(`- Board ID: ${message.data?.boardId}`);

              try {
                await messageHandler.handleMessage(message);
                console.log(
                  "⭐ CRITICAL UPDATE MESSAGE - Handler completed successfully"
                );
              } catch (error) {
                console.error(
                  "⭐ CRITICAL UPDATE MESSAGE - Handler failed with error:",
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
          console.log(`Editor received message: ${message.command}`);
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
          console.log(`Board editor received message: ${message.command}`);
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
}

// This method is called when your extension is deactivated
export function deactivate() {}
