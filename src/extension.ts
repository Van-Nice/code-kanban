// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import { MessageHandler } from "./messageHandler";

let extensionContext: vscode.ExtensionContext;
let messageHandler: MessageHandler;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  // Set up webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("boogieWebview", {
      resolveWebviewView(webviewView: vscode.WebviewView) {
        // Enable scripts and set resource roots
        webviewView.webview.options = {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, "dist")),
          ],
        };

        // Get the path to the compiled webview.js and convert it to a webview URI
        const webviewJsPath = vscode.Uri.file(
          path.join(context.extensionPath, "dist", "webview.js")
        );
        const webviewJsUri = webviewView.webview.asWebviewUri(webviewJsPath);

        // Get the path to the CSS file
        const webviewCssPath = vscode.Uri.file(
          path.join(context.extensionPath, "dist", "webview.css")
        );
        const webviewCssUri = webviewView.webview.asWebviewUri(webviewCssPath);

        // Initialize the message handler
        messageHandler = new MessageHandler(webviewView.webview);

        // Set up message listener
        webviewView.webview.onDidReceiveMessage(
          (message) => {
            messageHandler.handleMessage(message);
          },
          undefined,
          context.subscriptions
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
            vscode.Uri.file(path.join(context.extensionPath, "dist")),
          ],
        }
      );

      // Initialize message handler
      messageHandler = new MessageHandler(panel.webview);

      // Set up message listener
      panel.webview.onDidReceiveMessage(
        (message) => {
          messageHandler.handleMessage(message);
        },
        undefined,
        context.subscriptions
      );

      // Get the path to the compiled webview.js and convert it to a webview URI
      const webviewJsPath = vscode.Uri.file(
        path.join(context.extensionPath, "dist", "webview.js")
      );
      const webviewJsUri = panel.webview.asWebviewUri(webviewJsPath);

      // Get the path to the CSS file
      const webviewCssPath = vscode.Uri.file(
        path.join(context.extensionPath, "dist", "webview.css")
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
          <script src="${webviewJsUri}"></script>
        </body>
        </html>
      `;
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
