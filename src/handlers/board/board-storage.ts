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
    columns: board.columns.map((c) => convertToApiColumn(c)),
    columnIds: board.columns.map((c) => c.id),
    createdAt: new Date(board.createdAt),
    updatedAt: new Date(board.updatedAt),
  };
}

function convertToApiColumn(column: SharedColumn): Column {
  // Ensure we have a valid boardId, default to empty string if not available
  let boardId = "";
  for (const card of column.cards) {
    if (card.boardId) {
      boardId = card.boardId;
      break;
    }
  }

  return {
    id: column.id,
    title: column.title,
    boardId: boardId,
    cards: column.cards.map((c) => convertToApiCard(c)),
    cardIds: column.cards.map((c) => c.id),
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

  public async saveBoard(board: Board): Promise<void> {
    const data = this.getData();

    // Get existing columns if available
    const existingColumns: SharedColumn[] = [];
    const existingBoard = data.boards.get(board.id);

    if (existingBoard) {
      for (const columnId of existingBoard.columnIds) {
        const columnData = data.columns.get(columnId);
        if (columnData) {
          const cards: SharedCard[] = [];

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
                boardId: board.id,
                order: cardData.order,
                createdAt: cardData.createdAt,
                updatedAt: cardData.updatedAt,
              });
            }
          }

          existingColumns.push({
            id: columnId,
            title: columnData.title,
            cards,
            order: columnData.order,
            createdAt: columnData.createdAt,
            updatedAt: columnData.updatedAt,
          });
        }
      }
    }

    // Convert to storage format
    const sharedBoard = convertToStorageBoard(board, existingColumns);

    // Update board metadata
    const boardMetadata: BoardMetadata = {
      id: sharedBoard.id,
      title: sharedBoard.title,
      description: sharedBoard.description,
      columnIds: board.columnIds || board.columns.map((col) => col.id),
      createdAt: sharedBoard.createdAt,
      updatedAt: sharedBoard.updatedAt,
    };
    data.boards.set(board.id, boardMetadata);

    // Get the set of all card IDs referenced by columnIds
    const currentCardIds = new Set<string>();
    const columnIds = board.columnIds || board.columns.map((col) => col.id);
    for (const columnId of columnIds) {
      const columnData = data.columns.get(columnId);
      if (columnData) {
        for (const cardId of columnData.cardIds) {
          currentCardIds.add(cardId);
        }
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
          labels: cardData.labels,
          assignee: cardData.assignee,
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
      cards: cardsArray,
      order: columnData.order,
      createdAt: columnData.createdAt,
      updatedAt: columnData.updatedAt,
    };

    return convertToApiColumn(sharedColumn);
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
    const data = this.getData();

    // Create/update card data
    const cardData: CardData = {
      id: card.id,
      title: card.title,
      description: card.description,
      labels: [],
      assignee: "",
      columnId: card.columnId,
      boardId: card.boardId,
      order: 0, // Default order
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };

    data.cards.set(card.id, cardData);

    // Update column to include card if needed
    const column = data.columns.get(card.columnId);
    if (column && !column.cardIds.includes(card.id)) {
      column.cardIds.push(card.id);
      data.columns.set(card.columnId, column);
    }

    await this.saveData(data);
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
      labels: cardData.labels,
      assignee: cardData.assignee,
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

  public async moveCard(cardId: string, newColumnId: string): Promise<void> {
    const data = this.getData();
    const card = data.cards.get(cardId);
    const newColumn = data.columns.get(newColumnId);

    if (!card || !newColumn) {
      return;
    }

    // Remove from old column
    const oldColumn = data.columns.get(card.columnId);
    if (oldColumn) {
      oldColumn.cardIds = oldColumn.cardIds.filter((cId) => cId !== cardId);
      data.columns.set(card.columnId, oldColumn);
    }

    // Add to new column
    if (!newColumn.cardIds.includes(cardId)) {
      newColumn.cardIds.push(cardId);
    }

    // Update card
    card.columnId = newColumnId;

    data.cards.set(cardId, card);
    data.columns.set(newColumnId, newColumn);

    await this.saveData(data);
  }

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
