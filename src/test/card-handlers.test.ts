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
import { TestLogger } from "./test-utils";

suite("Card Handler Tests", () => {
  let boardStorage: BoardStorage;
  let testBoard: Board;
  let testColumn: Column;
  let extensionContext: vscode.ExtensionContext;
  let mockStorage: Map<string, any>;
  let testLogger: TestLogger;

  suiteSetup(async () => {
    mockStorage = new Map();
    testLogger = new TestLogger();
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
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testBoard.columns.push(testColumn);
    await boardStorage.saveBoard(testBoard);
  });

  test("should add a card", async () => {
    const card: Card = {
      id: "test-card-1",
      title: "New Card",
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
          card,
        },
      },
      { storage: boardStorage, logger: testLogger }
    );

    assert.strictEqual(response.command, "cardAdded");
    assert.strictEqual(response.data.success, true);
    assert.ok(response.data.card);

    const boards = await boardStorage.getBoards();
    const board = boards.find((b) => b.id === testBoard.id);
    assert.strictEqual(board?.columns[0].cards.length, 1);
    assert.strictEqual(board?.columns[0].cards[0].title, "New Card");
  });

  test("should update a card", async () => {
    const card: Card = {
      id: "test-card-1",
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

    testBoard.columns[0].cards.push(card);
    await boardStorage.saveBoard(testBoard);

    const updatedCard: Card = {
      ...card,
      title: "Updated Card",
      description: "Updated Description",
      labels: ["updated"],
      assignee: "user2",
      order: 1,
    };

    const response = await handleUpdateCard(
      {
        command: "updateCard",
        data: {
          boardId: testBoard.id,
          columnId: testColumn.id,
          card: updatedCard,
        },
      },
      { storage: boardStorage, logger: testLogger }
    );

    assert.strictEqual(response.command, "cardUpdated");
    assert.strictEqual(response.data.success, true);

    const boards = await boardStorage.getBoards();
    const board = boards.find((b) => b.id === testBoard.id);
    const updatedCardInBoard = board?.columns[0].cards[0];
    assert.strictEqual(updatedCardInBoard?.title, "Updated Card");
    assert.strictEqual(updatedCardInBoard?.description, "Updated Description");
    assert.deepStrictEqual(updatedCardInBoard?.labels, ["updated"]);
    assert.strictEqual(updatedCardInBoard?.assignee, "user2");
    assert.strictEqual(updatedCardInBoard?.order, 1);
  });

  test("should delete a card", async () => {
    const card: Card = {
      id: "test-card-2",
      title: "Card to Delete",
      description: "Will be deleted",
      labels: ["test"],
      assignee: "user1",
      columnId: testColumn.id,
      boardId: testBoard.id,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testBoard.columns[0].cards.push(card);
    await boardStorage.saveBoard(testBoard);

    const response = await handleDeleteCard(
      {
        command: "deleteCard",
        data: {
          boardId: testBoard.id,
          columnId: testColumn.id,
          cardId: card.id,
        },
      },
      { storage: boardStorage, logger: testLogger }
    );

    assert.strictEqual(response.command, "cardDeleted");
    assert.strictEqual(response.data.success, true);

    const boards = await boardStorage.getBoards();
    const board = boards.find((b) => b.id === testBoard.id);
    assert.strictEqual(board?.columns[0].cards.length, 0);
  });

  test("should move a card between columns", async () => {
    const sourceColumn: Column = {
      id: "source-column",
      title: "Source Column",
      cards: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const targetColumn: Column = {
      id: "target-column",
      title: "Target Column",
      cards: [],
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testBoard.columns = [sourceColumn, targetColumn];
    await boardStorage.saveBoard(testBoard);

    const card: Card = {
      id: "test-card-3",
      title: "Card to Move",
      description: "Will be moved",
      labels: ["test"],
      assignee: "user1",
      columnId: sourceColumn.id,
      boardId: testBoard.id,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testBoard.columns[0].cards.push(card);
    await boardStorage.saveBoard(testBoard);

    const response = await handleMoveCard(
      {
        command: "moveCard",
        data: {
          boardId: testBoard.id,
          cardId: card.id,
          fromColumnId: sourceColumn.id,
          toColumnId: targetColumn.id,
          position: 0,
        },
      },
      { storage: boardStorage, logger: testLogger }
    );

    assert.strictEqual(response.command, "cardMoved");
    assert.strictEqual(response.data.success, true);

    const boards = await boardStorage.getBoards();
    const board = boards.find((b) => b.id === testBoard.id);
    assert.strictEqual(board?.columns[0].cards.length, 0);
    assert.strictEqual(board?.columns[1].cards.length, 1);
    assert.strictEqual(board?.columns[1].cards[0].title, "Card to Move");
  });
});
