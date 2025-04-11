import { Commands } from "../shared/commands";

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

  // Add specific logging for addCard before the try block
  if (message.command === Commands.ADD_CARD) {
    console.log(
      `*** PRE-SEND CHECK (addCard): vscodeApi type = ${typeof vscodeApi}, postMessage type = ${typeof vscodeApi?.postMessage}`
    );
  }

  try {
    console.log(
      `Attempting to call postMessage with command: ${message.command}...`
    );

    // Add specific logging immediately before the call for addCard
    if (message.command === Commands.ADD_CARD) {
      console.log(
        `*** ABOUT TO POST (addCard): Message = ${JSON.stringify(message)}`
      );
    }

    vscodeApi.postMessage(message);

    // Add specific logging immediately after the call for addCard
    if (message.command === Commands.ADD_CARD) {
      console.log(
        `*** POST MESSAGE CALLED (addCard): No immediate error thrown.`
      );
    }

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

// Set up a message listener
export function setupMessageListener(
  callback: (message: VSCodeMessage) => void
) {
  console.log("Setting up message listener");
  // Create the event handler function
  const eventHandler = (event: MessageEvent) => {
    console.log("Message received from extension:", event.data);
    const message = event.data as VSCodeMessage;

    // Log the raw message received by the core listener
    console.log(
      ">>> vscodeMessaging: Raw message event received in listener:",
      JSON.stringify(message)
    );

    // Only process messages with a valid command
    if (message && message.command) {
      console.log(`Processing message with command: ${message.command}`);
      callback(message);
    } else {
      console.log("Ignoring invalid message without command:", message);
    }
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

// Logging utilities
export function log(message: string, data?: any) {
  // Add timestamp for debugging
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;

  // Safely stringify data to avoid circular references
  let safeData = undefined;
  if (data !== undefined) {
    try {
      // Using a custom replacer to handle circular references
      const seen = new WeakSet();
      safeData = JSON.parse(
        JSON.stringify(data, (key, value) => {
          // Handle circular references
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular]";
            }
            seen.add(value);
          }
          return value;
        })
      );
    } catch (err) {
      safeData = { error: "Could not stringify data", message: String(err) };
    }
  }

  // Log to console as well for easier debugging in the devtools
  console.log(formattedMessage, safeData);

  sendMessage({
    command: "log",
    data: { message: formattedMessage, data: safeData },
  });
}

export function error(message: string, err?: any) {
  // Add timestamp for debugging
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ERROR: ${message}`;

  // Convert error to a safe object
  let safeError = undefined;
  if (err !== undefined) {
    if (err instanceof Error) {
      safeError = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    } else {
      try {
        // Using a custom replacer to handle circular references
        const seen = new WeakSet();
        safeError = JSON.parse(
          JSON.stringify(err, (key, value) => {
            // Handle circular references
            if (typeof value === "object" && value !== null) {
              if (seen.has(value)) {
                return "[Circular]";
              }
              seen.add(value);
            }
            return value;
          })
        );
      } catch (e) {
        safeError = {
          error: "Could not stringify error object",
          message: String(err),
        };
      }
    }
  }

  // Log to console as well for easier debugging in the devtools
  console.error(formattedMessage, safeError);

  sendMessage({
    command: "error",
    data: { message: formattedMessage, error: safeError },
  });
}
