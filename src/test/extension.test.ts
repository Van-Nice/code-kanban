import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
// import * as myExtension from '../../extension';
import { BoardStorage } from "../handlers/board/board-storage";
import {
  Board,
  Column,
  Card,
  STORAGE_KEYS,
  isBoardMetadata,
  isColumnData,
  isCardData,
} from "../shared/types";

suite("Extension Test Suite", () => {
  let boardStorage: BoardStorage;
  let testBoard: Board;
  let extensionContext: vscode.ExtensionContext;
  let mockStorage: Map<string, any>;

  suiteSetup(async () => {
    // Create a mock storage
    mockStorage = new Map();

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
        get: (key: string) => {
          return mockStorage.get(key);
        },
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

    // Initialize board storage
    boardStorage = new BoardStorage(extensionContext);

    // Create a test board
    testBoard = {
      id: "test-board-1",
      title: "Test Board",
      description: "Test board description",
      columns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await boardStorage.saveBoard(testBoard);
  });

  suiteTeardown(async () => {
    // Clean up test board
    await boardStorage.deleteBoard(testBoard.id);
  });

  suite("Board Storage Tests", () => {
    test("should initialize with empty storage", async () => {
      const boards = await boardStorage.getBoards();
      assert.strictEqual(boards.length, 0, "Storage should be empty initially");
    });

    test("should save and retrieve a board", async () => {
      const board: Board = {
        id: "test-board-1",
        title: "Test Board",
        description: "Test Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await boardStorage.saveBoard(board);
      const boards = await boardStorage.getBoards();
      const savedBoard = boards.find((b) => b.id === board.id);

      assert.ok(savedBoard, "Board should be saved");
      assert.strictEqual(
        savedBoard?.title,
        board.title,
        "Board title should match"
      );
      assert.strictEqual(
        savedBoard?.description,
        board.description,
        "Board description should match"
      );
      assert.strictEqual(
        savedBoard?.columns.length,
        0,
        "Board should have no columns initially"
      );
    });

    test("should update a board", async () => {
      const board: Board = {
        id: "test-board-2",
        title: "Original Title",
        description: "Original Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await boardStorage.saveBoard(board);
      board.title = "Updated Title";
      board.description = "Updated Description";
      await boardStorage.saveBoard(board);

      const boards = await boardStorage.getBoards();
      const updatedBoard = boards.find((b) => b.id === board.id);

      assert.strictEqual(
        updatedBoard?.title,
        "Updated Title",
        "Board title should be updated"
      );
      assert.strictEqual(
        updatedBoard?.description,
        "Updated Description",
        "Board description should be updated"
      );
    });

    test("should delete a board", async () => {
      const board: Board = {
        id: "test-board-3",
        title: "Board to Delete",
        description: "Will be deleted",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await boardStorage.saveBoard(board);
      await boardStorage.deleteBoard(board.id);

      const boards = await boardStorage.getBoards();
      const deletedBoard = boards.find((b) => b.id === board.id);

      assert.strictEqual(deletedBoard, undefined, "Board should be deleted");
    });
  });

  suite("Column Operations Tests", () => {
    let testBoard: Board;

    setup(async () => {
      testBoard = {
        id: "column-test-board",
        title: "Column Test Board",
        description: "For testing columns",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await boardStorage.saveBoard(testBoard);
    });

    test("should add a column to a board", async () => {
      const column: Column = {
        id: "test-column-1",
        title: "Test Column",
        cards: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(column);
      await boardStorage.saveBoard(testBoard);

      const boards = await boardStorage.getBoards();
      const boardWithColumn = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithColumn?.columns.length,
        1,
        "Board should have one column"
      );
      assert.strictEqual(
        boardWithColumn?.columns[0].title,
        "Test Column",
        "Column title should match"
      );
    });

    test("should update a column", async () => {
      const column: Column = {
        id: "test-column-2",
        title: "Original Column",
        cards: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(column);
      await boardStorage.saveBoard(testBoard);

      testBoard.columns[0].title = "Updated Column";
      await boardStorage.saveBoard(testBoard);

      const boards = await boardStorage.getBoards();
      const boardWithUpdatedColumn = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithUpdatedColumn?.columns[0].title,
        "Updated Column",
        "Column title should be updated"
      );
    });

    test("should remove a column", async () => {
      const column: Column = {
        id: "test-column-3",
        title: "Column to Remove",
        cards: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(column);
      await boardStorage.saveBoard(testBoard);

      testBoard.columns = [];
      await boardStorage.saveBoard(testBoard);

      const boards = await boardStorage.getBoards();
      const boardWithoutColumn = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithoutColumn?.columns.length,
        0,
        "Board should have no columns"
      );
    });
  });

  suite("Card Operations Tests", () => {
    let testBoard: Board;
    let testColumn: Column;

    setup(async () => {
      testBoard = {
        id: "card-test-board",
        title: "Card Test Board",
        description: "For testing cards",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testColumn = {
        id: "card-test-column",
        title: "Card Test Column",
        cards: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(testColumn);
      await boardStorage.saveBoard(testBoard);
    });

    teardown(async () => {
      // Clean up the test board and all its data
      await boardStorage.deleteBoard(testBoard.id);
    });

    test("should add a card to a column", async () => {
      const card: Card = {
        id: "test-card-1",
        title: "Test Card",
        description: "Test Description",
        labels: ["test"],
        assignee: "test-user",
        columnId: testColumn.id,
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns[0].cards.push(card);
      await boardStorage.saveBoard(testBoard);

      const boards = await boardStorage.getBoards();
      const boardWithCard = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithCard?.columns[0].cards.length,
        1,
        "Column should have one card"
      );
      assert.strictEqual(
        boardWithCard?.columns[0].cards[0].title,
        "Test Card",
        "Card title should match"
      );
    });

    test("should update a card", async () => {
      const card: Card = {
        id: "test-card-2",
        title: "Original Card",
        description: "Original Description",
        labels: ["test"],
        assignee: "test-user",
        columnId: testColumn.id,
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns[0].cards.push(card);
      await boardStorage.saveBoard(testBoard);

      testBoard.columns[0].cards[0].title = "Updated Card";
      await boardStorage.saveBoard(testBoard);

      const boards = await boardStorage.getBoards();
      const boardWithUpdatedCard = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithUpdatedCard?.columns[0].cards[0].title,
        "Updated Card",
        "Card title should be updated"
      );
    });

    test("should remove a card", async () => {
      const card: Card = {
        id: "test-card-3",
        title: "Card to Remove",
        description: "Will be removed",
        labels: ["test"],
        assignee: "test-user",
        columnId: testColumn.id,
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns[0].cards.push(card);
      await boardStorage.saveBoard(testBoard);

      testBoard.columns[0].cards = [];
      await boardStorage.saveBoard(testBoard);

      const boards = await boardStorage.getBoards();
      const boardWithoutCard = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithoutCard?.columns[0].cards.length,
        0,
        "Column should have no cards"
      );
    });
  });

  suite("Error Handling Tests", () => {
    test("should handle non-existent board", async () => {
      const boards = await boardStorage.getBoards();
      const nonExistentBoard = boards.find((b) => b.id === "non-existent-id");
      assert.strictEqual(
        nonExistentBoard,
        undefined,
        "Non-existent board should return undefined"
      );
    });

    test("should handle invalid board data", async () => {
      try {
        await boardStorage.saveBoard({} as Board);
        assert.fail("Should have thrown an error for invalid board data");
      } catch (error) {
        assert.ok(error instanceof Error, "Should throw an error");
      }
    });
  });

  suite("Type Guard Tests", () => {
    test("should validate board metadata", () => {
      const validMetadata = {
        id: "test-id",
        title: "Test Board",
        description: "Test Description",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        columnIds: [],
      };

      const invalidMetadata = {
        id: "test-id",
        title: "Test Board",
        description: "Test Description",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Missing columnIds
      };

      assert.ok(isBoardMetadata(validMetadata), "Valid metadata should pass");
      assert.ok(
        !isBoardMetadata(invalidMetadata),
        "Invalid metadata should fail"
      );
    });

    test("should validate column data", () => {
      const validColumnData = {
        id: "test-id",
        title: "Test Column",
        boardId: "board-1",
        order: 0,
        cardIds: [],
      };

      const invalidColumnData = {
        id: "test-id",
        title: "Test Column",
        boardId: "board-1",
        order: 0,
        // Missing cardIds
      };

      assert.ok(isColumnData(validColumnData), "Valid column data should pass");
      assert.ok(
        !isColumnData(invalidColumnData),
        "Invalid column data should fail"
      );
    });

    test("should validate card data", () => {
      const validCardData = {
        id: "test-id",
        title: "Test Card",
        description: "Test Description",
        columnId: "column-1",
        boardId: "board-1",
        order: 0,
        labels: [],
        assignee: "user1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const invalidCardData = {
        id: "test-id",
        title: "Test Card",
        description: "Test Description",
        columnId: "column-1",
        boardId: "board-1",
        order: 0,
        labels: [],
        // Missing assignee, createdAt, updatedAt
      };

      assert.ok(isCardData(validCardData), "Valid card data should pass");
      assert.ok(!isCardData(invalidCardData), "Invalid card data should fail");
    });
  });

  suite("Migration Tests", () => {
    test("should handle data migration", async () => {
      const oldData = {
        version: "1.0.0",
        boards: {
          "board-1": {
            id: "board-1",
            title: "Old Board",
            description: "Old Description",
            columns: [],
          },
        },
      };

      mockStorage.set(STORAGE_KEYS.BOARDS, oldData);
      const boards = await boardStorage.getBoards();

      assert.strictEqual(boards.length, 1, "Should migrate old data format");
      assert.strictEqual(
        boards[0].title,
        "Old Board",
        "Should preserve board data"
      );
    });
  });

  suite("Storage Queue Tests", () => {
    test("should process save queue", async () => {
      const board1: Board = {
        id: "queue-test-1",
        title: "Queue Test 1",
        description: "Test Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const board2: Board = {
        id: "queue-test-2",
        title: "Queue Test 2",
        description: "Test Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await boardStorage.saveBoard(board1);
      await boardStorage.saveBoard(board2);

      const boards = await boardStorage.getBoards();
      assert.strictEqual(boards.length, 2, "Should save both boards");
    });

    test("should handle concurrent saves", async () => {
      const board: Board = {
        id: "concurrent-test",
        title: "Concurrent Test",
        description: "Test Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const savePromises = Array(5)
        .fill(null)
        .map(() => boardStorage.saveBoard(board));
      await Promise.all(savePromises);

      const boards = await boardStorage.getBoards();
      assert.strictEqual(
        boards.length,
        1,
        "Should handle concurrent saves correctly"
      );
    });
  });
});
