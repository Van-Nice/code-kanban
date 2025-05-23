import * as vscode from "vscode";
import type {
  Board as SharedBoard,
  Column as SharedColumn,
  Card as SharedCard,
  StorageData,
  BoardMetadata,
  ColumnData,
  CardData,
} from "../../shared/types";
import {
  STORAGE_KEYS,
  CURRENT_STORAGE_VERSION,
  isBoardMetadata,
  isColumnData,
  isCardData,
} from "../../shared/types";
import { migrateData } from "../../shared/migrations";
import { Board, Card, Column } from "../../models/board";
import { Storage } from "../../models/storage";

/**
 * Adapters for converting between storage types and API model types
 */
function convertToApiBoard(board: SharedBoard): Board {
  return {
    id: board.id,
    title: board.title,
    description: board.description || "",
    columns: board.columns.map((c) => convertToApiColumn(c, "")),
    columnIds: board.columns.map((c) => c.id),
    createdAt: new Date(board.createdAt),
    updatedAt: new Date(board.updatedAt),
  };
}

function convertToApiColumn(column: SharedColumn, boardId: string): Column {
  return {
    id: column.id,
    title: column.title,
    boardId: boardId,
    cards: column.cards.map((c) => convertToApiCard(c)),
    cardIds: column.cards.map((c) => c.id),
    order: column.order || 0,
    createdAt: new Date(column.createdAt),
    updatedAt: new Date(column.updatedAt),
  };
}

function convertToApiCard(card: SharedCard): Card {
  return {
    id: card.id,
    title: card.title,
    description: card.description || "",
    columnId: card.columnId,
    boardId: card.boardId,
    tags: card.tags || [],
    order: card.order || 0,
    createdAt: new Date(card.createdAt),
    updatedAt: new Date(card.updatedAt),
  };
}

function convertToStorageBoard(
  board: Board,
  columns: SharedColumn[] = []
): SharedBoard {
  return {
    id: board.id,
    title: board.title,
    description: board.description || "",
    columns: columns,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

export class BoardStorage implements Storage {
  private context: vscode.ExtensionContext;
  private saveInProgress: boolean = false;
  private saveQueue: Array<{
    data: StorageData;
    resolve: (value: void | PromiseLike<void>) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initializeStorage();
  }

  private async initializeStorage() {
    const version = this.context.globalState.get<string>(STORAGE_KEYS.VERSION);
    if (!version) {
      // First time setup
      await this.context.globalState.update(
        STORAGE_KEYS.VERSION,
        CURRENT_STORAGE_VERSION
      );
      await this.saveData({
        boards: new Map(),
        columns: new Map(),
        cards: new Map(),
      });
    } else if (version !== CURRENT_STORAGE_VERSION) {
      // Migrate data to current version
      const data = await this.loadRawData();
      const migratedData = await migrateData(version, data);
      await this.saveData(migratedData);
      await this.context.globalState.update(
        STORAGE_KEYS.VERSION,
        CURRENT_STORAGE_VERSION
      );
    }
  }

  private async loadRawData(): Promise<StorageData> {
    try {
      const rawBoards =
        this.context.globalState.get<BoardMetadata[]>(STORAGE_KEYS.BOARDS) ||
        [];
      const rawColumns =
        this.context.globalState.get<ColumnData[]>(STORAGE_KEYS.COLUMNS) || [];
      const rawCards =
        this.context.globalState.get<CardData[]>(STORAGE_KEYS.CARDS) || [];

      // Handle old format if present
      if (!Array.isArray(rawBoards) && typeof rawBoards === "object") {
        console.log("BoardData is not an array:", typeof rawBoards);
        const oldBoards = (rawBoards as any).boards;
        if (oldBoards) {
          // Convert old format boards to the new format
          const boardsMap = new Map<string, BoardMetadata>();
          const columnsMap = new Map<string, ColumnData>();
          const cardsMap = new Map<string, CardData>();

          Object.entries(oldBoards).forEach(([id, boardData]) => {
            const board = boardData as any;

            // Process columns from old format
            const columnIds: string[] = [];
            if (board.columns && Array.isArray(board.columns)) {
              board.columns.forEach((oldColumn: any) => {
                const columnId = oldColumn.id;
                columnIds.push(columnId);

                // Extract cards from old column format
                const cardIds: string[] = [];
                if (oldColumn.cards && Array.isArray(oldColumn.cards)) {
                  oldColumn.cards.forEach((oldCard: any) => {
                    const cardId = oldCard.id;
                    cardIds.push(cardId);

                    // Create card in new format
                    cardsMap.set(cardId, {
                      id: cardId,
                      title: oldCard.title || "Untitled Card",
                      description: oldCard.description || "",
                      columnId: columnId,
                      boardId: id,
                      tags: oldCard.tags || [],
                      order: oldCard.order || 0,
                      createdAt: oldCard.createdAt || new Date().toISOString(),
                      updatedAt: oldCard.updatedAt || new Date().toISOString(),
                    });
                  });
                }

                // Create column in new format
                columnsMap.set(columnId, {
                  id: columnId,
                  title: oldColumn.title || "Untitled Column",
                  boardId: id,
                  cardIds: cardIds,
                  order: oldColumn.order || 0,
                  createdAt: oldColumn.createdAt || new Date().toISOString(),
                  updatedAt: oldColumn.updatedAt || new Date().toISOString(),
                });
              });
            }

            // Create board in new format
            boardsMap.set(id, {
              id: board.id || id,
              title: board.title || "Untitled Board",
              description: board.description || "",
              columnIds: columnIds,
              createdAt: board.createdAt || new Date().toISOString(),
              updatedAt: board.updatedAt || new Date().toISOString(),
            });
          });

          // After successful migration, update the storage to use the new format
          const storageData = {
            boards: Array.from(boardsMap.values()),
            columns: Array.from(columnsMap.values()),
            cards: Array.from(cardsMap.values()),
          };

          // Save the migrated data
          await this.context.globalState.update(
            STORAGE_KEYS.BOARDS,
            storageData.boards
          );
          await this.context.globalState.update(
            STORAGE_KEYS.COLUMNS,
            storageData.columns
          );
          await this.context.globalState.update(
            STORAGE_KEYS.CARDS,
            storageData.cards
          );

          return {
            boards: boardsMap,
            columns: columnsMap,
            cards: cardsMap,
          };
        }
      }

      return {
        boards: new Map(rawBoards.map((board) => [board.id, board])),
        columns: new Map(rawColumns.map((column) => [column.id, column])),
        cards: new Map(rawCards.map((card) => [card.id, card])),
      };
    } catch (error) {
      console.error("Error loading raw data:", error);
      return {
        boards: new Map(),
        columns: new Map(),
        cards: new Map(),
      };
    }
  }

  private async processSaveQueue(): Promise<void> {
    if (this.saveQueue.length === 0 || this.saveInProgress) {
      return;
    }

    this.saveInProgress = true;
    const { data, resolve, reject } = this.saveQueue[0];

    try {
      // Validate data before saving
      this.validateStorageData(data);

      // Convert Maps to arrays for storage
      const storageData = {
        boards: Array.from(data.boards.values()),
        columns: Array.from(data.columns.values()),
        cards: Array.from(data.cards.values()),
      };

      // Save each part atomically
      await Promise.all([
        this.context.globalState.update(
          STORAGE_KEYS.BOARDS,
          storageData.boards
        ),
        this.context.globalState.update(
          STORAGE_KEYS.COLUMNS,
          storageData.columns
        ),
        this.context.globalState.update(STORAGE_KEYS.CARDS, storageData.cards),
      ]);

      resolve();
    } catch (error) {
      reject(error);
    } finally {
      // Remove the task we just processed
      this.saveQueue.shift();
      this.saveInProgress = false;

      // Process the next task in the queue if there is one
      if (this.saveQueue.length > 0) {
        // Use setTimeout to avoid stack overflow with deep recursion
        setTimeout(() => this.processSaveQueue(), 0);
      }
    }
  }

  private validateStorageData(data: StorageData): void {
    // Skip validation for empty data
    if (!data.boards || !data.columns || !data.cards) {
      console.warn("Storage data is incomplete, skipping validation");
      return;
    }

    // Validate boards
    for (const [id, board] of data.boards) {
      if (!isBoardMetadata(board)) {
        console.warn(`Invalid board metadata for board ${id}`);
        continue; // Skip this board instead of throwing
      }

      // Skip column validation if columnIds is not an array
      if (!Array.isArray(board.columnIds)) {
        console.warn(`Board ${id} has invalid columnIds (not an array)`);
        continue;
      }
    }

    // Validate columns
    for (const [id, column] of data.columns) {
      if (!isColumnData(column)) {
        console.warn(`Invalid column data for column ${id}`);
        continue; // Skip this column instead of throwing
      }

      // Validate column references - skip if board doesn't exist
      if (!data.boards.has(column.boardId)) {
        console.warn(
          `Column ${id} references non-existent board ${column.boardId}`
        );
        continue; // Skip further validation for this column
      }

      // Skip card validation if cardIds is not an array
      if (!Array.isArray(column.cardIds)) {
        console.warn(`Column ${id} has invalid cardIds (not an array)`);
        continue;
      }
    }

    // Validate cards
    for (const [id, card] of data.cards) {
      if (!isCardData(card)) {
        console.warn(`Invalid card data for card ${id}`);
        continue; // Skip this card instead of throwing
      }

      // Skip validation if column doesn't exist
      if (!data.columns.has(card.columnId)) {
        console.warn(
          `Card ${id} references non-existent column ${card.columnId}`
        );
        continue;
      }

      const column = data.columns.get(card.columnId);
      if (
        column &&
        Array.isArray(column.cardIds) &&
        !column.cardIds.includes(id)
      ) {
        console.warn(
          `Card ${id} exists but is not referenced by its column ${card.columnId}`
        );
        // Add the card ID to the column's cardIds array
        column.cardIds.push(id);
      }
    }

    // Validate board column references (softer validation)
    for (const [id, board] of data.boards) {
      if (!Array.isArray(board.columnIds)) {
        console.warn(`Board ${id} has invalid columnIds (not an array)`);
        continue;
      }

      for (const columnId of board.columnIds) {
        const column = data.columns.get(columnId);
        if (!column) {
          console.warn(
            `Board ${id} references non-existent column ${columnId}`
          );
          continue;
        }
        if (column.boardId !== id) {
          console.warn(
            `Column ${columnId} belongs to board ${column.boardId} but is referenced by board ${id}`
          );
          // Automatically fix the reference
          column.boardId = id;
        }
      }
    }
  }

  private getData(): StorageData {
    const boards = new Map<string, BoardMetadata>();
    const columns = new Map<string, ColumnData>();
    const cards = new Map<string, CardData>();

    try {
      // Load boards
      const boardData =
        this.context.globalState.get<BoardMetadata[]>(STORAGE_KEYS.BOARDS) ||
        [];

      // Check if boardData is an array before using forEach
      if (Array.isArray(boardData)) {
        boardData.forEach((board) => {
          if (isBoardMetadata(board)) {
            boards.set(board.id, board);
          }
        });
      } else {
        console.warn("BoardData is not an array:", typeof boardData);
      }

      // Load columns
      const columnData =
        this.context.globalState.get<ColumnData[]>(STORAGE_KEYS.COLUMNS) || [];

      // Check if columnData is an array before using forEach
      if (Array.isArray(columnData)) {
        columnData.forEach((column) => {
          if (isColumnData(column)) {
            columns.set(column.id, column);
          }
        });
      } else {
        console.warn("ColumnData is not an array:", typeof columnData);
      }

      // Load cards
      const cardData =
        this.context.globalState.get<CardData[]>(STORAGE_KEYS.CARDS) || [];

      // Check if cardData is an array before using forEach
      if (Array.isArray(cardData)) {
        cardData.forEach((card) => {
          if (isCardData(card)) {
            cards.set(card.id, card);
          }
        });
      } else {
        console.warn("CardData is not an array:", typeof cardData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }

    return { boards, columns, cards };
  }

  public async getBoards(): Promise<Board[]> {
    const data = this.getData();
    const sharedBoards: SharedBoard[] = [];

    // Convert stored data into Board objects
    for (const [boardId, boardData] of data.boards) {
      const columns: SharedColumn[] = [];

      // Get all columns for this board
      for (const columnId of boardData.columnIds) {
        const columnData = data.columns.get(columnId);
        if (columnData) {
          const cards: SharedCard[] = [];

          // Get all cards for this column
          for (const cardId of columnData.cardIds) {
            const cardData = data.cards.get(cardId);
            if (cardData) {
              cards.push({
                id: cardId,
                title: cardData.title,
                description: cardData.description,
                tags: cardData.tags,
                columnId: columnId,
                boardId: boardId,
                order: cardData.order,
                createdAt: cardData.createdAt,
                updatedAt: cardData.updatedAt,
              });
            }
          }

          // Sort cards by order
          cards.sort((a, b) => a.order - b.order);

          columns.push({
            id: columnId,
            title: columnData.title,
            boardId: boardId,
            cards,
            cardIds: columnData.cardIds,
            order: columnData.order,
            createdAt: columnData.createdAt,
            updatedAt: columnData.updatedAt,
          });
        }
      }

      // Sort columns by order
      columns.sort((a, b) => a.order - b.order);

      sharedBoards.push({
        id: boardId,
        title: boardData.title,
        description: boardData.description,
        columns,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt,
      });
    }

    // Convert to API model format
    return sharedBoards.map((board) => convertToApiBoard(board));
  }

  private async saveData(data: StorageData): Promise<void> {
    return new Promise((resolve, reject) => {
      this.saveQueue.push({ data, resolve, reject });
      if (!this.saveInProgress) {
        this.processSaveQueue();
      }
    });
  }

  public async saveBoard(board: Board): Promise<void> {
    const data = await this.loadRawData();

    // Update board metadata
    const boardMetadata: BoardMetadata = {
      id: board.id,
      title: board.title,
      description: board.description || "",
      columnIds: board.columns.map((col) => col.id),
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
    };
    data.boards.set(board.id, boardMetadata);

    // Update columns and their cards
    const existingColumnIds = new Set(board.columns.map((col) => col.id));
    const existingCardIds = new Set<string>();

    // Remove columns that no longer exist in the board
    for (const [columnId, column] of data.columns) {
      if (column.boardId === board.id && !existingColumnIds.has(columnId)) {
        data.columns.delete(columnId);
        // Remove cards from deleted columns
        for (const cardId of column.cardIds) {
          data.cards.delete(cardId);
        }
      }
    }

    // Update columns and cards
    for (const column of board.columns) {
      const columnData: ColumnData = {
        id: column.id,
        title: column.title,
        boardId: board.id,
        cardIds: (column.cards || []).map((card) => card.id),
        order: column.order || 0,
        createdAt: column.createdAt.toISOString(),
        updatedAt: column.updatedAt.toISOString(),
      };
      data.columns.set(column.id, columnData);

      // Update cards
      for (const card of column.cards || []) {
        existingCardIds.add(card.id);
        const cardData: CardData = {
          id: card.id,
          title: card.title,
          description: card.description || "",
          tags: card.tags || [],
          columnId: column.id,
          boardId: board.id,
          order: card.order || 0,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        };
        data.cards.set(card.id, cardData);
      }
    }

    // Remove cards that no longer exist in any column
    for (const [cardId, card] of data.cards) {
      if (card.boardId === board.id && !existingCardIds.has(cardId)) {
        data.cards.delete(cardId);
      }
    }

    await this.saveData(data);
  }

  public async deleteBoard(boardId: string): Promise<void> {
    const { boards, columns, cards } = this.getData();

    const board = boards.get(boardId);
    if (!board) {
      return;
    }

    // Delete all cards in the board's columns
    if (Array.isArray(board.columnIds)) {
      board.columnIds.forEach((columnId) => {
        const column = columns.get(columnId);
        if (column && Array.isArray(column.cardIds)) {
          column.cardIds.forEach((cardId) => cards.delete(cardId));
          columns.delete(columnId);
        }
      });
    }

    // Remove the board
    boards.delete(boardId);

    await this.saveData({ boards, columns, cards });
  }

  // Storage interface implementation
  public async getBoard(id: string): Promise<Board | null> {
    const boards = await this.getBoards();
    return boards.find((board) => board.id === id) || null;
  }

  public async getColumn(id: string): Promise<Column | null> {
    const data = this.getData();
    const columnData = data.columns.get(id);

    if (!columnData) {
      return null;
    }

    const cardsArray: SharedCard[] = [];

    for (const cardId of columnData.cardIds) {
      const cardData = data.cards.get(cardId);
      if (cardData) {
        cardsArray.push({
          id: cardId,
          title: cardData.title,
          description: cardData.description,
          tags: cardData.tags,
          columnId: id,
          boardId: columnData.boardId,
          order: cardData.order,
          createdAt: cardData.createdAt,
          updatedAt: cardData.updatedAt,
        });
      }
    }

    const sharedColumn: SharedColumn = {
      id: columnData.id,
      title: columnData.title,
      boardId: columnData.boardId,
      cards: cardsArray,
      cardIds: columnData.cardIds,
      order: columnData.order,
      createdAt: columnData.createdAt,
      updatedAt: columnData.updatedAt,
    };

    return convertToApiColumn(sharedColumn, columnData.boardId);
  }

  public async getColumns(boardId: string): Promise<Column[]> {
    const data = this.getData();
    const board = data.boards.get(boardId);

    if (!board) {
      return [];
    }

    const columns: Column[] = [];

    for (const columnId of board.columnIds) {
      const column = await this.getColumn(columnId);
      if (column) {
        columns.push(column);
      }
    }

    return columns;
  }

  public async saveColumn(column: Column): Promise<void> {
    const data = this.getData();

    // Create/update column data
    const columnData: ColumnData = {
      id: column.id,
      title: column.title,
      boardId: column.boardId,
      cardIds: column.cardIds,
      order: 0, // Default order
      createdAt: column.createdAt.toISOString(),
      updatedAt: column.updatedAt.toISOString(),
    };

    data.columns.set(column.id, columnData);

    // Update board to include column if needed
    const board = data.boards.get(column.boardId);
    if (board && !board.columnIds.includes(column.id)) {
      board.columnIds.push(column.id);
      data.boards.set(column.boardId, board);
    }

    await this.saveData(data);
  }

  public async deleteColumn(id: string): Promise<void> {
    const data = this.getData();
    const column = data.columns.get(id);

    if (!column) {
      return;
    }

    // Delete all cards in this column
    column.cardIds.forEach((cardId) => {
      data.cards.delete(cardId);
    });

    // Remove column
    data.columns.delete(id);

    // Update board to remove column reference
    const board = data.boards.get(column.boardId);
    if (board) {
      board.columnIds = board.columnIds.filter((cId) => cId !== id);
      data.boards.set(column.boardId, board);
    }

    await this.saveData(data);
  }

  public async saveCard(card: Card): Promise<void> {
    try {
      console.log("🔍 BoardStorage.saveCard called with card:", card);

      if (!card.id || !card.columnId || !card.boardId) {
        console.error(
          "🔍 BoardStorage.saveCard - Invalid card data. Missing required fields:",
          {
            id: card.id || "MISSING",
            columnId: card.columnId || "MISSING",
            boardId: card.boardId || "MISSING",
          }
        );
        throw new Error("Invalid card data. Missing required fields.");
      }

      const data = this.getData();

      // Verify column exists
      const column = data.columns.get(card.columnId);
      if (!column) {
        console.error(
          `🔍 BoardStorage.saveCard - Column ${card.columnId} not found`
        );
        throw new Error(`Column ${card.columnId} not found`);
      }

      // Verify board exists
      const board = data.boards.get(card.boardId);
      if (!board) {
        console.error(
          `🔍 BoardStorage.saveCard - Board ${card.boardId} not found`
        );
        throw new Error(`Board ${card.boardId} not found`);
      }

      // Create/update card data
      const cardData: CardData = {
        id: card.id,
        title: card.title,
        description: card.description || "",
        tags: card.tags || [],
        columnId: card.columnId,
        boardId: card.boardId,
        order: card.order || 0,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
      };

      data.cards.set(card.id, cardData);

      // Update column to include card if needed
      if (column && !column.cardIds.includes(card.id)) {
        column.cardIds.push(card.id);
        data.columns.set(card.columnId, column);
      }

      await this.saveData(data);
      console.log(
        "🔍 BoardStorage.saveCard - Successfully saved card:",
        card.id
      );
    } catch (error) {
      console.error("🔍 BoardStorage.saveCard - Error saving card:", error);
      throw error;
    }
  }

  public async getCard(id: string): Promise<Card | null> {
    const data = this.getData();
    const cardData = data.cards.get(id);

    if (!cardData) {
      return null;
    }

    const sharedCard: SharedCard = {
      id: cardData.id,
      title: cardData.title,
      description: cardData.description,
      tags: cardData.tags,
      columnId: cardData.columnId,
      boardId: cardData.boardId,
      order: cardData.order,
      createdAt: cardData.createdAt,
      updatedAt: cardData.updatedAt,
    };

    return convertToApiCard(sharedCard);
  }

  public async getCards(columnId: string): Promise<Card[]> {
    const data = this.getData();
    const column = data.columns.get(columnId);

    if (!column) {
      return [];
    }

    const cards: Card[] = [];

    for (const cardId of column.cardIds) {
      const card = await this.getCard(cardId);
      if (card) {
        cards.push(card);
      }
    }

    return cards;
  }

  public async deleteCard(id: string): Promise<void> {
    const data = this.getData();
    const card = data.cards.get(id);

    if (!card) {
      return;
    }

    // Remove card
    data.cards.delete(id);

    // Update column to remove card reference
    const column = data.columns.get(card.columnId);
    if (column) {
      column.cardIds = column.cardIds.filter((cId) => cId !== id);
      data.columns.set(card.columnId, column);
    }

    await this.saveData(data);
  }

  // Move card, handling both inter-column and intra-column moves
  public async moveCard(
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    position: number // 0-based index for insertion
  ): Promise<void> {
    const data = this.getData();
    const card = data.cards.get(cardId);
    const fromColumn = data.columns.get(fromColumnId);
    const toColumn = data.columns.get(toColumnId);

    if (!card || !fromColumn || !toColumn) {
      console.error(
        `Cannot move card: Card (${!!card}), fromColumn (${!!fromColumn}), or toColumn (${!!toColumn}) not found.`
      );
      throw new Error(
        `Card, source column, or destination column not found during move operation.`
      );
    }

    // 1. Remove from source column's cardIds
    const currentCardIndex = fromColumn.cardIds.indexOf(cardId);
    if (currentCardIndex === -1) {
      console.warn(
        `Card ${cardId} not found in source column ${fromColumnId} cardIds during move.`
      );
      // Attempt to continue, but log this anomaly
    } else {
      fromColumn.cardIds.splice(currentCardIndex, 1);
    }

    // 2. Add to destination column's cardIds at the specified position
    // Clamp position to valid range [0, toColumn.cardIds.length]
    const insertPosition = Math.max(
      0,
      Math.min(position, toColumn.cardIds.length)
    );
    toColumn.cardIds.splice(insertPosition, 0, cardId);

    // 3. Update the card's columnId
    card.columnId = toColumnId;
    card.updatedAt = new Date().toISOString(); // Update timestamp

    // 4. Update the column timestamps
    fromColumn.updatedAt = new Date().toISOString();
    toColumn.updatedAt = new Date().toISOString();

    // 5. Update the maps in storage data
    data.cards.set(cardId, card);
    data.columns.set(fromColumnId, fromColumn);
    // Ensure we update the destination column even if it's the same as source
    data.columns.set(toColumnId, toColumn);

    // 6. Save the modified data
    await this.saveData(data);
    console.log(
      `Card ${cardId} moved from ${fromColumnId} to ${toColumnId} at position ${insertPosition}`
    );
  }

  // --- Methods for Collapsed State (Using workspaceState) ---

  /** Key for storing column collapsed states in workspaceState */
  private readonly collapsedStateKey = "codeKanbanUIStates";

  /**
   * Retrieves the persisted collapsed states for all columns within a specific board.
   * Reads from workspaceState, specific to the current workspace.
   * @param boardId The ID of the board to get column states for.
   * @returns A promise resolving to an object mapping column IDs to their collapsed state (true=collapsed),
   *          or an empty object if no state is found for the board.
   */
  public async getColumnCollapsedStates(
    boardId: string
  ): Promise<{ [columnId: string]: boolean }> {
    try {
      const allBoardStates = this.context.workspaceState.get<{
        [boardId: string]: { [columnId: string]: boolean };
      }>(this.collapsedStateKey, {}); // Default to empty object if key doesn't exist

      // Return the state for the specific board, or an empty object if not found
      return allBoardStates[boardId] || {};
    } catch (error) {
      console.error(
        `Error getting column collapsed states for board ${boardId}:`,
        error
      );
      // Return empty object in case of error to avoid breaking UI
      return {};
    }
  }

  /**
   * Persists the collapsed state for a single column within a specific board.
   * Writes to workspaceState, specific to the current workspace.
   * @param boardId The ID of the board containing the column.
   * @param columnId The ID of the column whose state is being set.
   * @param collapsed The new collapsed state (true=collapsed, false=expanded).
   * @returns A promise that resolves when the state has been updated.
   */
  public async setColumnCollapsedState(
    boardId: string,
    columnId: string,
    collapsed: boolean
  ): Promise<void> {
    try {
      // 1. Get the current state for ALL boards
      const allBoardStates = this.context.workspaceState.get<{
        [boardId: string]: { [columnId: string]: boolean };
      }>(this.collapsedStateKey, {});

      // 2. Ensure the state object for this specific board exists
      allBoardStates[boardId] = allBoardStates[boardId] || {};

      // 3. Update the state for the specific column
      allBoardStates[boardId][columnId] = collapsed;

      // 4. Write the entire updated state object back
      await this.context.workspaceState.update(
        this.collapsedStateKey,
        allBoardStates
      );
      console.log(
        `Set collapsed state for ${boardId}/${columnId} to ${collapsed}`
      );
    } catch (error) {
      console.error(
        `Error setting column collapsed state for board ${boardId}, column ${columnId}:`,
        error
      );
      // Optionally re-throw or handle the error appropriately
      // throw error;
    }
  }

  // --- End Collapsed State Methods ---

  public async clear(): Promise<void> {
    await this.saveData({
      boards: new Map(),
      columns: new Map(),
      cards: new Map(),
    });
  }

  public async load(): Promise<void> {
    // Already handled by getData()
    this.getData();
  }

  public async save(): Promise<void> {
    // Just ensure any pending saves are processed
    if (this.saveQueue.length > 0) {
      await this.processSaveQueue();
    }
  }
}
