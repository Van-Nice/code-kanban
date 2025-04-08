// Define the message interface
export interface VSCodeMessage {
  command: string;
  data?: any;
}

// Get the VSCode API
let vscodeApi: any;
let webviewContext: string = "sidebar";
// Map to store event handler references
const messageListeners = new Map<
  (message: VSCodeMessage) => void,
  (event: MessageEvent) => void
>();

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
  // Create the event handler function
  const eventHandler = (event: MessageEvent) => {
    const message = event.data as VSCodeMessage;
    callback(message);
  };

  // Store reference to the handler
  messageListeners.set(callback, eventHandler);

  // Add event listener
  window.addEventListener("message", eventHandler);
}

// Remove a message listener
export function removeMessageListener(
  callback: (message: VSCodeMessage) => void
) {
  // Get the stored event handler
  const eventHandler = messageListeners.get(callback);

  if (eventHandler) {
    // Remove the event listener using the same function reference
    window.removeEventListener("message", eventHandler);
    // Remove from our map
    messageListeners.delete(callback);
  }
}
