// Define the message interface
export interface VSCodeMessage {
  command: string;
  data?: any;
}

// Get the VSCode API
let vscodeApi: any;

// Initialize the VSCode API
export function initializeVSCodeApi() {
  if (!vscodeApi) {
    // @ts-ignore - acquireVsCodeApi is injected by VSCode
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
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
