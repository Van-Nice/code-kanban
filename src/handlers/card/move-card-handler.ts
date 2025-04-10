import { BoardStorage } from "../board/board-storage";
import { MessageHandlerBase, HandlerContext } from "../message-handler";
import {
  MoveCardMessage,
  CardMovedResponse,
  WebviewResponse,
} from "../messages";
import {
  Board as ModelBoard,
  Column as ModelColumn,
  Card as ModelCard,
} from "../../models/board";
import { Board, Column, Card } from "../board/board";
import { Logger } from "../logger";
import * as vscode from "vscode";

export class MoveCardHandler extends MessageHandlerBase<
  MoveCardMessage,
  WebviewResponse
> {
  constructor(
    private boardStorage: BoardStorage,
    logger: Logger,
    webviewContext: string,
    webview: vscode.Webview,
    vscodeContext: vscode.ExtensionContext
  ) {
    super();
    this.boardStorage = boardStorage;
  }

  async handle(
    message: MoveCardMessage,
    _context: HandlerContext
  ): Promise<WebviewResponse> {
    const {
      boardId,
      cardId,
      fromColumnId,
      toColumnId,
      position = 0,
    } = message.data;
    const boards = await this.boardStorage.getBoards();
    const board = boards.find((b) => b.id === boardId) as unknown as Board;

    if (!board) {
      throw new Error(`Board ${boardId} not found`);
    }

    const fromColumn = board.columns.find(
      (c) => c.id === fromColumnId
    ) as unknown as Column;
    const toColumn = board.columns.find(
      (c) => c.id === toColumnId
    ) as unknown as Column;

    if (!fromColumn || !toColumn) {
      throw new Error("Source or target column not found");
    }

    if (!fromColumn.cards) {
      throw new Error(`Column ${fromColumnId} has no cards array`);
    }

    if (!toColumn.cards) {
      throw new Error(`Column ${toColumnId} has no cards array`);
    }

    const cardIndex = fromColumn.cards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      throw new Error(`Card ${cardId} not found in column ${fromColumnId}`);
    }

    const [card] = fromColumn.cards.splice(cardIndex, 1);
    card.columnId = toColumnId;
    toColumn.cards.splice(position, 0, card);

    // Convert the Board to ModelBoard before saving
    const modelBoard: ModelBoard = {
      ...board,
      description: board.description || "", // Ensure description is not undefined
      columns: board.columns.map((col) => ({
        id: col.id,
        title: col.title,
        boardId: board.id,
        cards: col.cards?.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description || "",
          columnId: c.columnId,
          boardId: board.id,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        })),
        cardIds: col.cards?.map((c) => c.id) || [],
        createdAt: new Date(col.createdAt),
        updatedAt: new Date(col.updatedAt),
      })),
      createdAt: new Date(board.createdAt),
      updatedAt: new Date(board.updatedAt),
    };

    await this.boardStorage.saveBoard(modelBoard);

    return {
      command: "cardMoved",
      data: {
        success: true,
        cardId,
        fromColumnId,
        toColumnId,
        boardId,
        position,
      },
    };
  }
}

export async function handleMoveCard(
  message: MoveCardMessage,
  context: HandlerContext
): Promise<CardMovedResponse> {
  const { storage, logger } = context;

  if (
    !message.data?.boardId ||
    !message.data?.cardId ||
    !message.data?.fromColumnId ||
    !message.data?.toColumnId
  ) {
    logger.error("Missing required fields for card movement");
    return {
      command: "cardMoved",
      data: {
        success: false,
        boardId: message.data?.boardId || "",
        cardId: message.data?.cardId || "",
        fromColumnId: message.data?.fromColumnId || "",
        toColumnId: message.data?.toColumnId || "",
        error:
          "Missing required fields: boardId, cardId, fromColumnId, or toColumnId",
      },
    };
  }

  try {
    const boards = await storage.getBoards();
    const board = boards.find(
      (b) => b.id === message.data.boardId
    ) as unknown as Board;

    if (!board) {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: "cardMoved",
        data: {
          success: false,
          boardId: message.data.boardId,
          cardId: message.data.cardId,
          fromColumnId: message.data.fromColumnId,
          toColumnId: message.data.toColumnId,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }

    // Find source and target columns
    const sourceColumn = board.columns.find(
      (c) => c.id === message.data.fromColumnId
    ) as unknown as Column;
    const targetColumn = board.columns.find(
      (c) => c.id === message.data.toColumnId
    ) as unknown as Column;

    if (!sourceColumn || !targetColumn) {
      logger.error("Source or target column not found");
      return {
        command: "cardMoved",
        data: {
          success: false,
          boardId: message.data.boardId,
          cardId: message.data.cardId,
          fromColumnId: message.data.fromColumnId,
          toColumnId: message.data.toColumnId,
          error: "Source or target column not found",
        },
      };
    }

    // Find and remove card from source column
    if (!sourceColumn.cards) {
      logger.error(`Column ${message.data.fromColumnId} has no cards array`);
      return {
        command: "cardMoved",
        data: {
          success: false,
          boardId: message.data.boardId,
          cardId: message.data.cardId,
          fromColumnId: message.data.fromColumnId,
          toColumnId: message.data.toColumnId,
          error: `Column ${message.data.fromColumnId} has no cards array`,
        },
      };
    }

    const cardIndex = sourceColumn.cards.findIndex(
      (c) => c.id === message.data.cardId
    );
    if (cardIndex === -1) {
      logger.error(
        `Card with ID ${message.data.cardId} not found in source column`
      );
      return {
        command: "cardMoved",
        data: {
          success: false,
          boardId: message.data.boardId,
          cardId: message.data.cardId,
          fromColumnId: message.data.fromColumnId,
          toColumnId: message.data.toColumnId,
          error: `Card with ID ${message.data.cardId} not found in source column`,
        },
      };
    }

    const [card] = sourceColumn.cards.splice(cardIndex, 1);
    card.columnId = targetColumn.id;

    // Insert card at target position
    if (!targetColumn.cards) {
      targetColumn.cards = [];
    }

    const targetPosition = message.data.position ?? 0;
    targetColumn.cards.splice(targetPosition, 0, card);

    // Update card order
    if (targetColumn.cards) {
      targetColumn.cards.forEach((c, index) => {
        if ("order" in c) {
          (c as any).order = index;
        }
      });
    }

    // Convert the Board to ModelBoard before saving
    const modelBoard: ModelBoard = {
      ...board,
      description: board.description || "", // Ensure description is not undefined
      columns: board.columns.map((col) => ({
        id: col.id,
        title: col.title,
        boardId: board.id,
        cards: col.cards?.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description || "",
          columnId: c.columnId,
          boardId: board.id,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        })),
        cardIds: col.cards?.map((c) => c.id) || [],
        createdAt: new Date(col.createdAt),
        updatedAt: new Date(col.updatedAt),
      })),
      createdAt: new Date(board.createdAt),
      updatedAt: new Date(board.updatedAt),
    };

    await storage.saveBoard(modelBoard);

    logger.debug(
      `Card ${message.data.cardId} moved from column ${message.data.fromColumnId} to ${message.data.toColumnId}`
    );
    return {
      command: "cardMoved",
      data: {
        success: true,
        boardId: message.data.boardId,
        cardId: message.data.cardId,
        fromColumnId: message.data.fromColumnId,
        toColumnId: message.data.toColumnId,
      },
    };
  } catch (error) {
    logger.error("Error moving card:", error);
    return {
      command: "cardMoved",
      data: {
        success: false,
        boardId: message.data?.boardId || "",
        cardId: message.data?.cardId || "",
        fromColumnId: message.data?.fromColumnId || "",
        toColumnId: message.data?.toColumnId || "",
        error: `Failed to move card: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
