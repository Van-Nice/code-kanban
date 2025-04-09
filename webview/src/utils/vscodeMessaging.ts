// Define the message interface
export interface VSCodeMessage {
  command: string;
  data?: any;
}

// Type declaration for acquireVsCodeApi which is injected by VSCode
declare function acquireVsCodeApi(): any;

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
  console.log("Initializing VSCode API");
  if (!vscodeApi) {
    try {
      console.log("Attempting to acquire VSCode API...");
      // Check if we're in a valid VSCode webview context
      // @ts-ignore - acquireVsCodeApi is injected by VSCode
      if (typeof acquireVsCodeApi === "function") {
        // @ts-ignore
        vscodeApi = acquireVsCodeApi();
        console.log("VSCode API acquired successfully");
      } else {
        throw new Error(
          "acquireVsCodeApi is not a function, current context might not be a VSCode webview"
        );
      }
    } catch (error) {
      console.error("Error acquiring VSCode API:", error);
      console.error("Context details:", {
        inBrowser: typeof window !== "undefined",
        hasAcquireVSCodeApi: typeof acquireVsCodeApi !== "undefined",
        location: window?.location?.href,
      });
    }
  } else {
    console.log("VSCode API already initialized, reusing existing instance");
  }

  // Get the webview context from the window object
  // @ts-ignore - window.webviewContext is injected by the extension
  if (window.webviewContext) {
    // @ts-ignore
    webviewContext = window.webviewContext;
    console.log("Webview context set to:", webviewContext);
  } else {
    console.log(
      "No webview context found in window object, using default:",
      webviewContext
    );
  }

  return vscodeApi;
}

// Get the webview context
export function getWebviewContext(): string {
  return webviewContext;
}

// Send a message to the extension
export function sendMessage(message: VSCodeMessage) {
  console.log("Sending message to extension:", message);

  // Special handling for updateCard - critical persistence operation
  if (message.command === "updateCard") {
    console.log(
      "updateCard specific debug - message data:",
      JSON.stringify(message.data, null, 2)
    );

    // Use a more aggressive approach for updateCard
    sendMessageWithRetry(message, 3);
    return;
  }

  if (!vscodeApi) {
    console.log("vscodeApi not initialized, initializing now");
    vscodeApi = initializeVSCodeApi();
    if (vscodeApi) {
      console.log("vscodeApi initialized successfully");
    } else {
      console.error("vscodeApi initialization FAILED");
    }
  }

  if (!vscodeApi) {
    console.error("Failed to initialize vscodeApi, cannot send message");
    console.error(
      "Current window context:",
      typeof window,
      window.location.href
    );
    return;
  }

  try {
    console.log(
      `Attempting to call postMessage with command: ${message.command}...`
    );
    vscodeApi.postMessage(message);
    console.log(`Message with command '${message.command}' sent successfully`);
  } catch (error) {
    console.error(
      `Error sending message with command '${message.command}':`,
      error
    );
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "vscodeApi state:",
      typeof vscodeApi,
      !!vscodeApi,
      typeof vscodeApi?.postMessage
    );
  }
}

// Retry mechanism for critical messages
function sendMessageWithRetry(
  message: VSCodeMessage,
  maxRetries: number,
  currentRetry = 0
) {
  // Initialize if needed
  if (!vscodeApi) {
    vscodeApi = initializeVSCodeApi();
  }

  // If still no vscodeApi, try one last emergency initialization
  if (!vscodeApi && currentRetry === maxRetries - 1) {
    try {
      // @ts-ignore
      vscodeApi = acquireVsCodeApi();
    } catch (e) {
      console.error("Emergency vscodeApi acquisition failed:", e);
    }
  }

  if (!vscodeApi) {
    console.error("Cannot send message, no vscodeApi available");
    if (currentRetry < maxRetries) {
      console.log(
        `Retry attempt ${currentRetry + 1}/${maxRetries} in 500ms...`
      );
      setTimeout(
        () => sendMessageWithRetry(message, maxRetries, currentRetry + 1),
        500
      );
    }
    return;
  }

  try {
    vscodeApi.postMessage(message);
    console.log(
      `Message with command '${message.command}' sent successfully on attempt ${
        currentRetry + 1
      }`
    );
  } catch (error) {
    console.error(
      `Error sending message on attempt ${currentRetry + 1}:`,
      error
    );

    if (currentRetry < maxRetries) {
      console.log(
        `Retry attempt ${currentRetry + 1}/${maxRetries} in 500ms...`
      );
      setTimeout(
        () => sendMessageWithRetry(message, maxRetries, currentRetry + 1),
        500
      );
    }
  }
}

// Set up a message listener
export function setupMessageListener(
  callback: (message: VSCodeMessage) => void
) {
  console.log("Setting up message listener");
  // Create the event handler function
  const eventHandler = (event: MessageEvent) => {
    console.log("Message received from extension:", event.data);
    const message = event.data as VSCodeMessage;
    callback(message);
  };

  // Store reference to the handler
  messageListeners.set(callback, eventHandler);

  // Add event listener
  window.addEventListener("message", eventHandler);
  console.log("Message listener added to window");
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
