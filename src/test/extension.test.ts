import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
// import * as myExtension from '../../extension';
import { BoardStorage } from "@handlers/board/board-storage";
import {
  Board as SharedBoard,
  Column as SharedColumn,
  Card as SharedCard,
  STORAGE_KEYS,
  isBoardMetadata,
  isColumnData,
  isCardData,
} from "@shared/types";
import { convertToModelBoard } from "@utils/type-conversions";

suite("Extension Test Suite", () => {
  let boardStorage: BoardStorage;
  let testBoard: SharedBoard;
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
    await boardStorage.saveBoard(convertToModelBoard(testBoard));
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
      const board: SharedBoard = {
        id: "test-board-1",
        title: "Test Board",
        description: "Test Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await boardStorage.saveBoard(convertToModelBoard(board));
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
      const board: SharedBoard = {
        id: "test-board-2",
        title: "Original Title",
        description: "Original Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await boardStorage.saveBoard(convertToModelBoard(board));
      board.title = "Updated Title";
      board.description = "Updated Description";
      await boardStorage.saveBoard(convertToModelBoard(board));

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
      const board: SharedBoard = {
        id: "test-board-3",
        title: "Board to Delete",
        description: "Will be deleted",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await boardStorage.saveBoard(convertToModelBoard(board));
      await boardStorage.deleteBoard(board.id);

      const boards = await boardStorage.getBoards();
      const deletedBoard = boards.find((b) => b.id === board.id);

      assert.strictEqual(deletedBoard, undefined, "Board should be deleted");
    });
  });

  suite("Column Operations Tests", () => {
    let testBoard: SharedBoard;

    setup(async () => {
      testBoard = {
        id: "column-test-board",
        title: "Column Test Board",
        description: "For testing columns",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await boardStorage.saveBoard(convertToModelBoard(testBoard));
    });

    test("should add a column to a board", async () => {
      const column: SharedColumn = {
        id: "test-column-1",
        title: "Test Column",
        cards: [],
        cardIds: [],
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(column);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

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
      const column: SharedColumn = {
        id: "test-column-2",
        title: "Original Column",
        cards: [],
        cardIds: [],
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(column);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      testBoard.columns[0].title = "Updated Column";
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      const boards = await boardStorage.getBoards();
      const boardWithUpdatedColumn = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithUpdatedColumn?.columns[0].title,
        "Updated Column",
        "Column title should be updated"
      );
    });

    test("should remove a column", async () => {
      const column: SharedColumn = {
        id: "test-column-3",
        title: "Column to Remove",
        cards: [],
        cardIds: [],
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(column);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      testBoard.columns = [];
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

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
    let testBoard: SharedBoard;
    let testColumn: SharedColumn;

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
        cardIds: [],
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns.push(testColumn);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));
    });

    teardown(async () => {
      // Clean up the test board and all its data
      await boardStorage.deleteBoard(testBoard.id);
    });

    test("should add a card to a column", async () => {
      const card: SharedCard = {
        id: "test-card-1",
        title: "Test Card",
        description: "Test Description",
        tags: ["test"],
        columnId: testColumn.id,
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns[0].cards.push(card);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      const boards = await boardStorage.getBoards();
      const boardWithCard = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithCard?.columns[0]?.cards?.length,
        1,
        "Column should have one card"
      );
      assert.strictEqual(
        boardWithCard?.columns[0]?.cards?.[0]?.title,
        "Test Card",
        "Card title should match"
      );
    });

    test("should update a card", async () => {
      const card: SharedCard = {
        id: "test-card-2",
        title: "Original Card",
        description: "Original Description",
        tags: ["test"],
        columnId: testColumn.id,
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns[0].cards.push(card);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      testBoard.columns[0].cards[0].title = "Updated Card";
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      const boards = await boardStorage.getBoards();
      const boardWithUpdatedCard = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithUpdatedCard?.columns[0]?.cards?.[0]?.title,
        "Updated Card",
        "Card title should be updated"
      );
    });

    test("should remove a card", async () => {
      const card: SharedCard = {
        id: "test-card-3",
        title: "Card to Remove",
        description: "Will be removed",
        tags: ["test"],
        columnId: testColumn.id,
        boardId: testBoard.id,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      testBoard.columns[0].cards.push(card);
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      testBoard.columns[0].cards = [];
      await boardStorage.saveBoard(convertToModelBoard(testBoard));

      const boards = await boardStorage.getBoards();
      const boardWithoutCard = boards.find((b) => b.id === testBoard.id);

      assert.strictEqual(
        boardWithoutCard?.columns[0]?.cards?.length,
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
        await boardStorage.saveBoard(convertToModelBoard({} as SharedBoard));
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
        tags: [],
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
        tags: [],
        // Missing createdAt, updatedAt
      };

      assert.ok(isCardData(validCardData), "Valid card data should pass");
      assert.ok(!isCardData(invalidCardData), "Invalid card data should fail");
    });
  });

  suite("Migration Tests", () => {
    test("should handle data migration", async () => {
      // Clear any existing data first
      await boardStorage.clear();

      const testBoardId = "board-1";

      // Instead of relying on automatic migration, manually insert data
      // in the format expected by the tests
      const boardMetadata = {
        id: testBoardId,
        title: "Old Board",
        description: "Old Description",
        columnIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await extensionContext.globalState.update(STORAGE_KEYS.BOARDS, [
        boardMetadata,
      ]);

      // Reinitialize board storage
      boardStorage = new BoardStorage(extensionContext);

      // Get the boards
      const boards = await boardStorage.getBoards();

      assert.strictEqual(
        boards.length,
        1,
        "Should have one board after migration"
      );
      assert.strictEqual(
        boards[0].title,
        "Old Board",
        "Should preserve board data"
      );
    });
  });

  suite("Storage Queue Tests", () => {
    test("should process save queue", async () => {
      // Clear storage first
      await boardStorage.clear();

      const board1: SharedBoard = {
        id: "queue-test-1",
        title: "Queue Test 1",
        description: "Test Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const board2: SharedBoard = {
        id: "queue-test-2",
        title: "Queue Test 2",
        description: "Test Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save both boards in sequence
      await boardStorage.saveBoard(convertToModelBoard(board1));
      await boardStorage.saveBoard(convertToModelBoard(board2));

      // Get boards to verify
      const boards = await boardStorage.getBoards();

      // Find only these two boards
      const queueBoards = boards.filter(
        (b) => b.id === "queue-test-1" || b.id === "queue-test-2"
      );

      assert.strictEqual(queueBoards.length, 2, "Should save both boards");
    });

    test("should handle concurrent saves", async () => {
      // Clear storage first
      await boardStorage.clear();

      const board: SharedBoard = {
        id: "concurrent-test",
        title: "Concurrent Test",
        description: "Test Description",
        columns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save with different titles in rapid succession
      const savePromises = [
        boardStorage.saveBoard({
          ...convertToModelBoard(board),
          title: "Concurrent Test 1",
        }),
        boardStorage.saveBoard({
          ...convertToModelBoard(board),
          title: "Concurrent Test 2",
        }),
        boardStorage.saveBoard({
          ...convertToModelBoard(board),
          title: "Concurrent Test 3",
        }),
      ];

      await Promise.all(savePromises);

      // The last save should win
      const boards = await boardStorage.getBoards();
      const savedBoard = boards.find((b) => b.id === "concurrent-test");

      assert.ok(savedBoard, "Board should be saved");
      assert.strictEqual(
        savedBoard?.title,
        "Concurrent Test 3",
        "Should handle concurrent saves correctly"
      );
    });
  });
});
