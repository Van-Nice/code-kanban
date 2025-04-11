import * as assert from "assert";
import * as vscode from "vscode";
import { BoardStorage } from "../handlers/board/board-storage";
import { Board, Column, Card } from "../shared/types";
import {
  handleAddCard,
  handleUpdateCard,
  handleDeleteCard,
  handleMoveCard,
} from "../handlers";
import { TestLogger, MockWebview } from "./test-utils";
import { convertToModelBoard } from "../utils/type-conversions";

suite("Card Handler Tests", () => {
  let boardStorage: BoardStorage;
  let testBoard: Board;
  let testColumn: Column;
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

    testColumn = {
      id: "test-column-1",
      title: "Test Column",
      cards: [],
      cardIds: [],
      boardId: testBoard.id,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testBoard.columns.push(testColumn);
    await boardStorage.saveBoard(convertToModelBoard(testBoard));
  });

  test("should add a card", async () => {
    const card: Card = {
      id: "test-card-1",
      title: "Test Card",
      description: "Test Description",
      labels: ["test"],
      assignee: "user1",
      columnId: testColumn.id,
      boardId: testBoard.id,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response = await handleAddCard(
      {
        command: "addCard",
        data: {
          boardId: testBoard.id,
          columnId: testColumn.id,
          cardId: card.id,
          title: card.title,
          description: card.description,
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

    assert.strictEqual(response.command, "cardAdded");
    assert.strictEqual(response.data.success, true);
    assert.ok(response.data.card);

    const boards = await boardStorage.getBoards();
    const board = boards.find((b) => b.id === testBoard.id);
    const column = board?.columns.find((c) => c.id === testColumn.id);
    assert.strictEqual(column?.cards?.length, 1);
    assert.strictEqual(column?.cards?.[0]?.title, "Test Card");
  });

  test("should update a card", async () => {
    const card: Card = {
      id: "test-card-2",
      title: "Original Card",
      description: "Original Description",
      labels: ["test"],
      assignee: "user1",
      columnId: testColumn.id,
      boardId: testBoard.id,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testColumn.cards.push(card);
    await boardStorage.saveBoard(convertToModelBoard(testBoard));

    const updatedCard: Card = {
      ...card,
      title: "Updated Card",
      description: "Updated Description",
    };

    const response = await handleUpdateCard(
      {
        command: "updateCard",
        data: {
          boardId: testBoard.id,
          columnId: testColumn.id,
          cardId: updatedCard.id,
          title: updatedCard.title,
          description: updatedCard.description,
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

    assert.strictEqual(response.command, "cardUpdated");
    assert.strictEqual(response.data.success, true);

    const boards = await boardStorage.getBoards();
    const board = boards.find((b) => b.id === testBoard.id);
    const column = board?.columns.find((c) => c.id === testColumn.id);
    assert.strictEqual(column?.cards?.[0]?.title, "Updated Card");
    assert.strictEqual(column?.cards?.[0]?.description, "Updated Description");
  });

  test("should delete a card", async () => {
    const card: Card = {
      id: "test-card-3",
      title: "Card to Delete",
      description: "Description",
      labels: ["test"],
      assignee: "user1",
      columnId: testColumn.id,
      boardId: testBoard.id,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testColumn.cards.push(card);
    await boardStorage.saveBoard(convertToModelBoard(testBoard));

    const response = await handleDeleteCard(
      {
        command: "deleteCard",
        data: {
          boardId: testBoard.id,
          columnId: testColumn.id,
          cardId: card.id,
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

    assert.strictEqual(response.command, "cardDeleted");
    assert.strictEqual(response.data.success, true);

    const boards = await boardStorage.getBoards();
    const board = boards.find((b) => b.id === testBoard.id);
    const column = board?.columns.find((c) => c.id === testColumn.id);
    assert.strictEqual(column?.cards?.length, 0);
  });

  test("should move a card", async () => {
    const card: Card = {
      id: "test-card-4",
      title: "Card to Move",
      description: "Description",
      labels: ["test"],
      assignee: "user1",
      columnId: testColumn.id,
      boardId: testBoard.id,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testColumn.cards.push(card);
    await boardStorage.saveBoard(convertToModelBoard(testBoard));

    const response = await handleMoveCard(
      {
        command: "moveCard",
        data: {
          boardId: testBoard.id,
          cardId: card.id,
          fromColumnId: testColumn.id,
          toColumnId: testColumn.id,
          position: 1,
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

    assert.strictEqual(response.command, "cardMoved");
    assert.strictEqual(response.data.success, true);

    const boards = await boardStorage.getBoards();
    const board = boards.find((b) => b.id === testBoard.id);
    const column = board?.columns.find((c) => c.id === testColumn.id);
    assert.strictEqual(column?.cards?.[0]?.id, card.id);
    assert.strictEqual(column?.cards?.[0]?.columnId, testColumn.id);
  });
});
