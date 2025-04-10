import * as assert from "assert";
import * as vscode from "vscode";
import { BoardStorage } from "../handlers/board/board-storage";
import { Board, Column, Card } from "../shared/types";
import {
  handleAddColumn,
  handleUpdateColumn,
  handleDeleteColumn,
  handleOpenBoardInEditor,
  handleShowErrorMessage,
} from "../handlers";
import { TestLogger, MockWebview } from "./test-utils";
import { convertToModelBoard } from "../utils/type-conversions";

suite("Message Handler Tests", () => {
  let boardStorage: BoardStorage;
  let testBoard: Board;
  let extensionContext: vscode.ExtensionContext;
  let mockStorage: Map<string, any>;
  let testLogger: TestLogger;
  let mockWebview: MockWebview;

  suiteSetup(async () => {
    mockStorage = new Map();
    testLogger = new TestLogger();
    mockWebview = new MockWebview();
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
        get: (key: string) => mockStorage.get(key),
        update: async (key: string, value: any) => {
          mockStorage.set(key, value);
          return Promise.resolve();
        },
        setKeysForSync: () => {},
        keys: () => Array.from(mockStorage.keys()),
      } as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        setKeysForSync: () => {},
        keys: () => [],
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

    boardStorage = new BoardStorage(extensionContext);
    testBoard = {
      id: "test-board-1",
      title: "Test Board",
      description: "Test Description",
      columns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await boardStorage.saveBoard(convertToModelBoard(testBoard));
  });

  suite("Column Handler Tests", () => {
    test("should add a column", async () => {
      const column: Column = {
        id: "test-column-1",
        title: "New Column",
        cards: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const response = await handleAddColumn(
        {
          command: "addColumn",
          data: {
            boardId: testBoard.id,
            columnId: column.id,
            title: column.title,
          },
        },
        {
          storage: boardStorage,
          logger: testLogger,
          webviewContext: "test",
          webview: mockWebview,
          vscodeContext: extensionContext,
        }
      );

      assert.strictEqual(response.command, "columnAdded");
      assert.strictEqual(response.data.success, true);
      assert.ok(response.data.column);

      const boards = await boardStorage.getBoards();
      const board = boards.find((b) => b.id === testBoard.id);
      assert.strictEqual(board?.columns.length, 1);
      assert.strictEqual(board?.columns[0].title, "New Column");
    });

    test("should update a column", async () => {
      const column: Column = {
        id: "test-column-1",
        title: "Original Column",
        cards: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(column);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      const updatedColumn: Column = {
        ...column,
        title: "Updated Column",
        order: 1,
      };

      const response = await handleUpdateColumn(
        {
          command: "updateColumn",
          data: {
            boardId: testBoard.id,
            columnId: updatedColumn.id,
            title: updatedColumn.title,
          },
        },
        {
          storage: boardStorage,
          logger: testLogger,
          webviewContext: "test",
          webview: mockWebview,
          vscodeContext: extensionContext,
        }
      );

      assert.strictEqual(response.command, "columnUpdated");
      assert.strictEqual(response.data.success, true);

      const boards = await boardStorage.getBoards();
      const board = boards.find((b) => b.id === testBoard.id);
      assert.strictEqual(board?.columns[0].title, "Updated Column");
      assert.strictEqual(board?.columns.length, 1);
    });

    test("should delete a column", async () => {
      const column: Column = {
        id: "test-column-2",
        title: "Column to Delete",
        cards: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(column);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      const response = await handleDeleteColumn(
        {
          command: "deleteColumn",
          data: {
            boardId: testBoard.id,
            columnId: column.id,
          },
        },
        {
          storage: boardStorage,
          logger: testLogger,
          webviewContext: "test",
          webview: mockWebview,
          vscodeContext: extensionContext,
        }
      );

      assert.strictEqual(response.command, "columnDeleted");
      assert.strictEqual(response.data.success, true);

      const boards = await boardStorage.getBoards();
      const board = boards.find((b) => b.id === testBoard.id);
      assert.strictEqual(board?.columns.length, 0);
    });
  });

  suite("Board Handler Tests", () => {
    test("should open board in editor", async () => {
      const response = await handleOpenBoardInEditor(
        {
          command: "openBoardInEditor",
          data: {
            boardId: testBoard.id,
          },
        },
        {
          storage: boardStorage,
          logger: testLogger,
          webviewContext: "test",
          webview: mockWebview,
          vscodeContext: extensionContext,
        }
      );

      assert.strictEqual(response.command, "boardOpenedInEditor");
      assert.strictEqual(response.data.success, true);
      assert.strictEqual(response.data.error, undefined);
    });

    test("should handle non-existent board", async () => {
      const response = await handleOpenBoardInEditor(
        {
          command: "openBoardInEditor",
          data: {
            boardId: "non-existent-id",
          },
        },
        {
          storage: boardStorage,
          logger: testLogger,
          webviewContext: "test",
          webview: mockWebview,
          vscodeContext: extensionContext,
        }
      );

      assert.strictEqual(response.command, "boardOpenedInEditor");
      assert.strictEqual(response.data.success, false);
      assert.ok(response.data.error);
    });

    test("should handle missing boardId", async () => {
      const response = await handleOpenBoardInEditor(
        {
          command: "openBoardInEditor",
          data: {},
        } as any,
        {
          storage: boardStorage,
          logger: testLogger,
          webviewContext: "test",
          webview: mockWebview,
          vscodeContext: extensionContext,
        }
      );

      assert.strictEqual(response.command, "boardOpenedInEditor");
      assert.strictEqual(response.data.success, false);
      assert.strictEqual(response.data.error, "Missing boardId");
    });
  });

  suite("Error Handler Tests", () => {
    test("should show error message", async () => {
      const response = await handleShowErrorMessage(
        {
          command: "showErrorMessage",
          data: {
            message: "Test error message",
          },
        },
        {
          storage: boardStorage,
          logger: testLogger,
          webviewContext: "test",
          webview: mockWebview,
          vscodeContext: extensionContext,
        }
      );

      assert.strictEqual(response.command, "errorMessageShown");
      assert.strictEqual(response.data.success, true);
      assert.strictEqual(response.data.error, undefined);
    });

    test("should handle missing message", async () => {
      const response = await handleShowErrorMessage(
        {
          command: "showErrorMessage",
          data: {},
        } as any,
        {
          storage: boardStorage,
          logger: testLogger,
          webviewContext: "test",
          webview: mockWebview,
          vscodeContext: extensionContext,
        }
      );

      assert.strictEqual(response.command, "errorMessageShown");
      assert.strictEqual(response.data.success, false);
      assert.strictEqual(response.data.error, "Missing error message");
    });
  });
});
