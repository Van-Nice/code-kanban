import { Logger } from "../handlers/logger";
import * as vscode from "vscode";

export class TestLogger extends Logger {
  constructor() {
    super({ debug: true });
  }

  // Override methods to add test-specific logging behavior
  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  log(_message: string, _data?: any): void {
    // No-op for tests
  }
}

export class MockWebview implements vscode.Webview {
  html: string = "";
  options: vscode.WebviewOptions = {};
  cspSource: string = "";
  asWebviewUri(localResource: vscode.Uri): vscode.Uri {
    return localResource;
  }
  onDidReceiveMessage = new vscode.EventEmitter<any>().event;
  postMessage(_message: any): Thenable<boolean> {
    return Promise.resolve(true);
  }
}
