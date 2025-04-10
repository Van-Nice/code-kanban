import * as vscode from "vscode";
import type {
  Board,
  Column,
  Card,
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

export class BoardStorage {
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

  private async loadRawData(): Promise<any> {
    const rawBoards =
      this.context.globalState.get<BoardMetadata[]>(STORAGE_KEYS.BOARDS) || [];
    const rawColumns =
      this.context.globalState.get<ColumnData[]>(STORAGE_KEYS.COLUMNS) || [];
    const rawCards =
      this.context.globalState.get<CardData[]>(STORAGE_KEYS.CARDS) || [];

    return {
      boards: new Map(rawBoards.map((board) => [board.id, board])),
      columns: new Map(rawColumns.map((column) => [column.id, column])),
      cards: new Map(rawCards.map((card) => [card.id, card])),
    };
  }

  private async saveData(data: StorageData): Promise<void> {
    return new Promise((resolve, reject) => {
      this.saveQueue.push({ data, resolve, reject });
      if (!this.saveInProgress) {
        this.processSaveQueue();
      }
    });
  }

  private async processSaveQueue(): Promise<void> {
    if (this.saveQueue.length === 0 || this.saveInProgress) {
      return;
    }

    this.saveInProgress = true;
    const { data, resolve, reject } = this.saveQueue.shift()!;

    try {
      // Validate data before saving
      this.validateStorageData(data);

      // Convert Maps to arrays for storage
      const storageData = {
        boards: Array.from(data.boards.values()),
        columns: Array.from(data.columns.values()),
        cards: Array.from(data.cards.values()),
      };

      // Save each part separately
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

      resolve();
    } catch (error) {
      reject(error);
    } finally {
      this.saveInProgress = false;
      if (this.saveQueue.length > 0) {
        this.processSaveQueue();
      }
    }
  }

  private validateStorageData(data: StorageData): void {
    // Validate boards
    for (const [id, board] of data.boards) {
      if (!isBoardMetadata(board)) {
        throw new Error(`Invalid board metadata for board ${id}`);
      }
    }

    // Validate columns
    for (const [id, column] of data.columns) {
      if (!isColumnData(column)) {
        throw new Error(`Invalid column data for column ${id}`);
      }
      // Validate column references
      if (!data.boards.has(column.boardId)) {
        throw new Error(
          `Column ${id} references non-existent board ${column.boardId}`
        );
      }
    }

    // Validate cards
    for (const [id, card] of data.cards) {
      if (!isCardData(card)) {
        throw new Error(`Invalid card data for card ${id}`);
      }
      // Validate card references
      if (!data.columns.has(card.columnId)) {
        throw new Error(
          `Card ${id} references non-existent column ${card.columnId}`
        );
      }
      const column = data.columns.get(card.columnId);
      if (column && !column.cardIds.includes(id)) {
        throw new Error(
          `Card ${id} exists but is not referenced by its column ${card.columnId}`
        );
      }
    }

    // Validate board column references
    for (const [id, board] of data.boards) {
      for (const columnId of board.columnIds) {
        const column = data.columns.get(columnId);
        if (!column) {
          throw new Error(
            `Board ${id} references non-existent column ${columnId}`
          );
        }
        if (column.boardId !== id) {
          throw new Error(
            `Column ${columnId} belongs to board ${column.boardId} but is referenced by board ${id}`
          );
        }
      }
    }

    // Validate column card references
    for (const [id, column] of data.columns) {
      for (const cardId of column.cardIds) {
        const card = data.cards.get(cardId);
        if (!card) {
          throw new Error(
            `Column ${id} references non-existent card ${cardId}`
          );
        }
        if (card.columnId !== id) {
          throw new Error(
            `Card ${cardId} belongs to column ${card.columnId} but is referenced by column ${id}`
          );
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
      boardData.forEach((board) => {
        if (isBoardMetadata(board)) {
          boards.set(board.id, board);
        }
      });

      // Load columns
      const columnData =
        this.context.globalState.get<ColumnData[]>(STORAGE_KEYS.COLUMNS) || [];
      columnData.forEach((column) => {
        if (isColumnData(column)) {
          columns.set(column.id, column);
        }
      });

      // Load cards
      const cardData =
        this.context.globalState.get<CardData[]>(STORAGE_KEYS.CARDS) || [];
      cardData.forEach((card) => {
        if (isCardData(card)) {
          cards.set(card.id, card);
        }
      });
    } catch (error) {
      console.error("Error loading data:", error);
    }

    return { boards, columns, cards };
  }

  public async getBoards(): Promise<Board[]> {
    const data = this.getData();
    const boards: Board[] = [];

    // Convert stored data into Board objects
    for (const [boardId, boardData] of data.boards) {
      const columns: Column[] = [];

      // Get all columns for this board
      for (const columnId of boardData.columnIds) {
        const columnData = data.columns.get(columnId);
        if (columnData) {
          const cards: Card[] = [];

          // Get all cards for this column
          for (const cardId of columnData.cardIds) {
            const cardData = data.cards.get(cardId);
            if (cardData) {
              cards.push({
                id: cardId,
                title: cardData.title,
                description: cardData.description,
                labels: cardData.labels,
                assignee: cardData.assignee,
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
            cards,
            order: columnData.order,
            createdAt: columnData.createdAt,
            updatedAt: columnData.updatedAt,
          });
        }
      }

      // Sort columns by order
      columns.sort((a, b) => a.order - b.order);

      boards.push({
        id: boardId,
        title: boardData.title,
        description: boardData.description,
        columns,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt,
      });
    }

    return boards;
  }

  public async saveBoard(board: Board): Promise<void> {
    const data = this.getData();

    // Update board metadata
    const boardMetadata: BoardMetadata = {
      id: board.id,
      title: board.title,
      description: board.description,
      columnIds: board.columns.map((col) => col.id),
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    };
    data.boards.set(board.id, boardMetadata);

    // Get the set of all card IDs in the board
    const currentCardIds = new Set<string>();
    for (const column of board.columns) {
      for (const card of column.cards) {
        currentCardIds.add(card.id);
      }
    }

    // Clean up any cards that are no longer in any column
    const existingCards = Array.from(data.cards.values()).filter(
      (card) => card.boardId === board.id
    );
    for (const card of existingCards) {
      if (!currentCardIds.has(card.id)) {
        data.cards.delete(card.id);
      }
    }

    // Update columns
    for (const column of board.columns) {
      const columnData: ColumnData = {
        id: column.id,
        title: column.title,
        boardId: board.id,
        cardIds: column.cards.map((card) => card.id),
        order: column.order,
        createdAt: column.createdAt,
        updatedAt: column.updatedAt,
      };
      data.columns.set(column.id, columnData);

      // Update cards
      for (const card of column.cards) {
        const cardData: CardData = {
          id: card.id,
          title: card.title,
          description: card.description,
          labels: card.labels,
          assignee: card.assignee,
          columnId: column.id,
          boardId: board.id,
          order: card.order,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        };
        data.cards.set(card.id, cardData);
      }
    }

    // Clean up any columns that were removed from this board
    const existingBoard = data.boards.get(board.id);
    if (existingBoard) {
      const currentColumnIds = new Set(board.columns.map((col) => col.id));
      const removedColumnIds = existingBoard.columnIds.filter(
        (columnId) => !currentColumnIds.has(columnId)
      );
      removedColumnIds.forEach((columnId) => {
        const column = data.columns.get(columnId);
        if (column) {
          column.cardIds.forEach((cardId) => data.cards.delete(cardId));
          data.columns.delete(columnId);
        }
      });
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
    board.columnIds.forEach((columnId) => {
      const column = columns.get(columnId);
      if (column) {
        column.cardIds.forEach((cardId) => cards.delete(cardId));
        columns.delete(columnId);
      }
    });

    // Delete the board
    boards.delete(boardId);

    await this.saveData({ boards, columns, cards });
  }
}
