import * as assert from "assert";
import * as vscode from "vscode";
import { MessageHandler } from "@src/handlers/message-handler";
import { WebviewMessage } from "@src/handlers/messages";
import { BoardStorage } from "@handlers/board/board-storage";
import { Board, Column, Card } from "@shared/types";
import { v4 as uuidv4 } from "uuid";

// Mocks the webview
class MockWebview implements vscode.Webview {
  options = {};
  html = "";
  cspSource = "";
  messages: any[] = [];
  onDidReceiveMessageHandlers: ((data: any) => void)[] = [];

  asWebviewUri(uri: vscode.Uri): vscode.Uri {
    return uri;
  }

  postMessage(message: any): Thenable<boolean> {
    this.messages.push(message);
    // Simulate the response from the webview for certain messages
    this.onDidReceiveMessageHandlers.forEach((handler) => handler(message));
    return Promise.resolve(true);
  }

  onDidReceiveMessage(handler: (data: any) => void): vscode.Disposable {
    this.onDidReceiveMessageHandlers.push(handler);
    return {
      dispose: () => {
        const index = this.onDidReceiveMessageHandlers.indexOf(handler);
        if (index >= 0) {
          this.onDidReceiveMessageHandlers.splice(index, 1);
        }
      },
    };
  }
}

suite("Extension End-to-End Tests", () => {
  let boardStorage: BoardStorage;
  let mockWebview: MockWebview;
  let messageHandler: MessageHandler;
  let extensionContext: vscode.ExtensionContext;
  let testBoard: Board;
  // Storage for our mock context
  let mockGlobalStorage: Map<string, any>;
  let mockWorkspaceStorage: Map<string, any>; // Map for workspaceState

  setup(async () => {
    // Instead of activating the extension, create a mock extension context
    mockGlobalStorage = new Map();
    mockWorkspaceStorage = new Map(); // Initialize map for workspaceState

    // Create a mock extension context
    extensionContext = {
      subscriptions: [],
      extensionPath: "",
      globalStoragePath: "",
      logPath: "",
      storagePath: "",
      extensionUri: vscode.Uri.parse("file:///test"),
      environmentVariableCollection: {
        getScoped: () => ({
          persistent: true,
          replace: () => {},
          append: () => {},
          prepend: () => {},
          get: () => undefined,
          forEach: () => {},
          delete: () => {},
          clear: () => {},
          description: "",
          [Symbol.iterator]: function* () {},
          get size() {
            return 0;
          },
        }),
        persistent: true,
        replace: () => {},
        append: () => {},
        prepend: () => {},
        get: () => undefined,
        forEach: () => {},
        delete: () => {},
        clear: () => {},
        description: "",
        [Symbol.iterator]: function* () {},
        get size() {
          return 0;
        },
      } as vscode.GlobalEnvironmentVariableCollection,
      extensionMode: vscode.ExtensionMode.Test,
      globalState: {
        get: (key: string) => mockGlobalStorage.get(key),
        update: async (key: string, value: any) => {
          mockGlobalStorage.set(key, value);
          return Promise.resolve();
        },
        setKeysForSync: () => {},
        keys: () => Array.from(mockGlobalStorage.keys()),
      } as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
      workspaceState: {
        get: <T>(key: string, defaultValue?: T): T | undefined => {
          return mockWorkspaceStorage.get(key) ?? defaultValue;
        },
        update: async (key: string, value: any) => {
          mockWorkspaceStorage.set(key, value);
          return Promise.resolve();
        },
        setKeysForSync: () => {},
        keys: () => Array.from(mockWorkspaceStorage.keys()),
      } as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
      secrets: {
        get: () => Promise.resolve(undefined),
        store: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>()
          .event,
      } as vscode.SecretStorage,
      extension: {} as vscode.Extension<any>,
      storageUri: vscode.Uri.parse("file:///test/storage"),
      globalStorageUri: vscode.Uri.parse("file:///test/global-storage"),
      logUri: vscode.Uri.parse("file:///test/logs"),
      asAbsolutePath: (relativePath: string) => relativePath,
      languageModelAccessInformation: {
        onDidChange: new vscode.EventEmitter<void>().event,
        canSendRequest: (chat: vscode.LanguageModelChat) => true,
      },
    };

    // Set up test board
    mockWebview = new MockWebview();
    boardStorage = new BoardStorage(extensionContext);
    messageHandler = new MessageHandler(
      mockWebview,
      extensionContext,
      boardStorage,
      "test"
    );

    // Clear storage before each test
    await boardStorage.clear();

    // Create test board with columns
    testBoard = {
      id: uuidv4(),
      title: "E2E Test Board",
      description: "Board for end-to-end tests",
      columns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add the board to storage
    await boardStorage.saveBoard({
      id: testBoard.id,
      title: testBoard.title,
      description: testBoard.description,
      columns: [],
      createdAt: new Date(testBoard.createdAt),
      updatedAt: new Date(testBoard.updatedAt),
    });
  });

  test("Full message flow for column operations", async () => {
    // Register a mock handler for the handleAddColumn command in our mocked context
    const mockHandlers: { [key: string]: any } = {};

    // Mock the handlers object in MessageHandler
    const originalHandlerRequire = require;
    require = function (id: string) {
      if (id === ".") {
        return mockHandlers;
      }
      return originalHandlerRequire(id);
    } as any;

    // Import the actual handler function directly
    const { handleAddColumn } = await import(
      "@src/handlers/column/add-column-handler"
    );
    const { handleUpdateColumn } = await import(
      "@src/handlers/column/update-column-handler"
    );
    const { handleDeleteColumn } = await import(
      "@src/handlers/column/delete-column-handler"
    );

    // Set up our mock handlers
    mockHandlers.handleAddColumn = handleAddColumn;
    mockHandlers.handleUpdateColumn = handleUpdateColumn;
    mockHandlers.handleDeleteColumn = handleDeleteColumn;

    // STEP 1: Create a column
    const createColumnMessage: WebviewMessage = {
      command: "addColumn",
      data: {
        boardId: testBoard.id,
        columnId: uuidv4(),
        title: "Test Column",
      },
    };

    // Send message directly to handler function
    const addColumnResponse = await handleAddColumn(createColumnMessage, {
      storage: boardStorage,
      logger: {
        debug: console.log,
        error: console.error,
        info: console.log,
      } as any,
      webviewContext: "test",
      webview: mockWebview,
      vscodeContext: extensionContext,
    });

    // Post the response to the mockWebview manually
    mockWebview.postMessage(addColumnResponse);

    // Verify response was sent with correct command and data structure
    const columnAddedResponse = mockWebview.messages.find(
      (m) => m.command === "columnAdded"
    );
    assert.ok(
      columnAddedResponse,
      "columnAdded response should be sent to webview"
    );
    assert.strictEqual(
      columnAddedResponse.data.success,
      true,
      "Column creation should succeed"
    );
    assert.ok(
      columnAddedResponse.data.column,
      "Response should include column data"
    );

    // Verify column was actually saved in storage
    const boards = await boardStorage.getBoards();
    const updatedBoard = boards.find((b) => b.id === testBoard.id);
    assert.strictEqual(
      updatedBoard?.columns.length,
      1,
      "Board should have one column"
    );
    assert.strictEqual(
      updatedBoard?.columns[0].title,
      "Test Column",
      "Column title should match"
    );

    // Store the column ID for next tests
    const columnId = columnAddedResponse.data.column.id;

    // STEP 2: Update the column
    const updateColumnMessage: WebviewMessage = {
      command: "updateColumn",
      data: {
        boardId: testBoard.id,
        columnId: columnId,
        title: "Updated Column",
      },
    };

    // Clear previous messages for cleaner assertions
    mockWebview.messages = [];

    // Send message directly to handler function
    const updateColumnResponse = await handleUpdateColumn(
      updateColumnMessage as any,
      {
        storage: boardStorage,
        logger: {
          debug: console.log,
          error: console.error,
          info: console.log,
        } as any,
        webviewContext: "test",
        webview: mockWebview,
        vscodeContext: extensionContext,
      }
    );

    // Post the response to the mockWebview manually
    mockWebview.postMessage(updateColumnResponse);

    // Verify response was sent
    const columnUpdatedResponse = mockWebview.messages.find(
      (m) => m.command === "columnUpdated"
    );
    assert.ok(
      columnUpdatedResponse,
      "columnUpdated response should be sent to webview"
    );
    assert.strictEqual(
      columnUpdatedResponse.data.success,
      true,
      "Column update should succeed"
    );

    // Verify column was updated in storage
    const boardsAfterUpdate = await boardStorage.getBoards();
    const boardAfterUpdate = boardsAfterUpdate.find(
      (b) => b.id === testBoard.id
    );
    assert.strictEqual(
      boardAfterUpdate?.columns[0].title,
      "Updated Column",
      "Column title should be updated"
    );

    // STEP 3: Delete the column
    const deleteColumnMessage: WebviewMessage = {
      command: "deleteColumn",
      data: {
        boardId: testBoard.id,
        columnId: columnId,
      },
    };

    // Clear previous messages for cleaner assertions
    mockWebview.messages = [];

    // Send message directly to handler function
    const deleteColumnResponse = await handleDeleteColumn(deleteColumnMessage, {
      storage: boardStorage,
      logger: {
        debug: console.log,
        error: console.error,
        info: console.log,
      } as any,
      webviewContext: "test",
      webview: mockWebview,
      vscodeContext: extensionContext,
    });

    // Post the response to the mockWebview manually
    mockWebview.postMessage(deleteColumnResponse);

    // Verify response was sent
    const columnDeletedResponse = mockWebview.messages.find(
      (m) => m.command === "columnDeleted"
    );
    assert.ok(
      columnDeletedResponse,
      "columnDeleted response should be sent to webview"
    );
    assert.strictEqual(
      columnDeletedResponse.data.success,
      true,
      "Column deletion should succeed"
    );

    // Verify column was deleted from storage
    const boardsAfterDelete = await boardStorage.getBoards();
    const boardAfterDelete = boardsAfterDelete.find(
      (b) => b.id === testBoard.id
    );
    assert.strictEqual(
      boardAfterDelete?.columns.length,
      0,
      "Board should have no columns"
    );

    // Restore the original require function
    require = originalHandlerRequire;
  });

  test("Full flow with board loaded message", async () => {
    // First, add a column to the board
    const column: Column = {
      id: uuidv4(),
      title: "Test Flow Column",
      cards: [],
      cardIds: [],
      boardId: testBoard.id,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add column to storage directly
    const board = await boardStorage.getBoard(testBoard.id);
    if (board) {
      board.columns.push({
        id: column.id,
        title: column.title,
        boardId: column.boardId,
        cards: [],
        cardIds: [],
        order: 0,
        createdAt: new Date(column.createdAt),
        updatedAt: new Date(column.updatedAt),
      });
      await boardStorage.saveBoard(board);
    }

    // STEP 1: Get board data (this replicates the initial board load)
    const getBoardMessage: WebviewMessage = {
      command: "getBoard",
      data: {
        boardId: testBoard.id,
      },
    };

    mockWebview.messages = [];
    await messageHandler.handleMessage(getBoardMessage);

    // Verify board data is returned
    const boardLoadedResponse = mockWebview.messages.find(
      (m) => m.command === "boardLoaded"
    );
    assert.ok(
      boardLoadedResponse,
      "boardLoaded response should be sent to webview"
    );
    assert.strictEqual(
      boardLoadedResponse.data.success,
      true,
      "Board load should succeed"
    );
    assert.ok(
      boardLoadedResponse.data.columns,
      "Response should include columns"
    );
    assert.strictEqual(
      boardLoadedResponse.data.columns.length,
      1,
      "Board should have one column"
    );

    // STEP 2 REMOVED - Handler should not receive boardLoaded from webview
  });
});
