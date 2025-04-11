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
import { Board, Column } from "../board/board";
import { Logger } from "../logger";
import * as vscode from "vscode";

export class MoveCardHandler extends MessageHandlerBase<
  MoveCardMessage,
  CardMovedResponse
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
  ): Promise<CardMovedResponse> {
    const {
      boardId,
      cardId,
      fromColumnId,
      toColumnId,
      position = 0,
    } = message.data;

    try {
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
        description: board.description || "",
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
            labels: (c as any).labels || [],
            assignee: (c as any).assignee || "",
            order: (c as any).order || 0,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          })),
          cardIds: col.cards?.map((c) => c.id) || [],
          order: col.order || 0,
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
          boardId,
          cardId,
          fromColumnId,
          toColumnId,
        },
      };
    } catch (error) {
      return {
        command: "cardMoved",
        data: {
          success: false,
          boardId,
          cardId,
          fromColumnId,
          toColumnId,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

export async function handleMoveCard(
  message: MoveCardMessage,
  context: HandlerContext
): Promise<CardMovedResponse> {
  const handler = new MoveCardHandler(
    context.storage,
    context.logger,
    context.webviewContext,
    context.webview,
    context.vscodeContext
  );
  return handler.handle(message, context);
}
