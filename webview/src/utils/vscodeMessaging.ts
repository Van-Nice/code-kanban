// Define the message interface
export interface VSCodeMessage {
  command: string;
  data?: any;
}

// Get the VSCode API
let vscodeApi: any;
let webviewContext: string = "sidebar";

// Initialize the VSCode API
export function initializeVSCodeApi() {
  if (!vscodeApi) {
    // @ts-ignore - acquireVsCodeApi is injected by VSCode
    vscodeApi = acquireVsCodeApi();
  }

  // Get the webview context from the window object
  // @ts-ignore - window.webviewContext is injected by the extension
  if (window.webviewContext) {
    // @ts-ignore
    webviewContext = window.webviewContext;
  }

  return vscodeApi;
}

// Get the webview context
export function getWebviewContext(): string {
  return webviewContext;
}

// Send a message to the extension
export function sendMessage(message: VSCodeMessage) {
  if (!vscodeApi) {
    vscodeApi = initializeVSCodeApi();
  }
  vscodeApi.postMessage(message);
}

// Set up a message listener
export function setupMessageListener(
  callback: (message: VSCodeMessage) => void
) {
  window.addEventListener("message", (event) => {
    const message = event.data as VSCodeMessage;
    callback(message);
  });
}

// Remove a message listener
export function removeMessageListener(
  callback: (message: VSCodeMessage) => void
) {
  window.removeEventListener("message", (event) => {
    const message = event.data as VSCodeMessage;
    callback(message);
  });
}
