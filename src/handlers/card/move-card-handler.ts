import { Commands } from "../../shared/commands";
import { Board, Column as ModelColumn } from "../../models/board";
import {
  MoveCardMessage,
  CardMovedResponse,
  ColumnResponse,
} from "../messages";
import { HandlerContext } from "../message-handler";
import { Column as SharedColumn } from "../../shared/types";

export async function handleMoveCard(
  message: MoveCardMessage,
  context: HandlerContext
): Promise<CardMovedResponse> {
  const { storage, logger } = context;
  const { cardId, fromColumnId, toColumnId, position, boardId } = message.data;

  logger.debug(
    `Handling moveCard: Card ${cardId} from ${fromColumnId} to ${toColumnId} at ${position} on board ${boardId}`
  );

  try {
    // 1. Perform the move in storage
    await storage.moveCard(
      cardId,
      fromColumnId,
      toColumnId,
      position ?? 0 // Default position to 0 if undefined
    );

    // 2. Fetch the updated board data to get the new column structure
    const updatedBoard: Board | null = await storage.getBoard(boardId);
    if (!updatedBoard) {
      throw new Error(`Board ${boardId} not found after moving card.`);
    }

    // 3. Extract the updated columns for the response, ensuring correct type
    const newColumns: SharedColumn[] = updatedBoard.columns.map(
      (col: ModelColumn) => ({
        id: col.id,
        title: col.title,
        boardId: col.boardId,
        cards: col.cards.map((card) => ({
          // Convert Card model to SharedCard type
          id: card.id,
          title: card.title,
          description: card.description,
          columnId: card.columnId,
          boardId: card.boardId,
          tags: card.tags,
          order: card.order,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        })),
        cardIds: col.cardIds,
        order: col.order,
        createdAt: col.createdAt.toISOString(),
        updatedAt: col.updatedAt.toISOString(),
      })
    );

    // 4. Send success response back to webview with updated columns
    const response: CardMovedResponse = {
      command: "cardMoved",
      data: {
        success: true,
        boardId,
        cardId,
        fromColumnId,
        toColumnId,
        newColumns: newColumns,
      },
    };
    logger.debug(
      `Card ${cardId} moved successfully. Sending CARD_MOVED response.`
    );
    return response;
  } catch (error) {
    logger.error(`Error moving card ${cardId}:`, error);
    // Send failure response
    return {
      command: "cardMoved",
      data: {
        success: false,
        boardId,
        cardId,
        fromColumnId,
        toColumnId,
        newColumns: [],
        error:
          error instanceof Error
            ? error.message
            : "An unknown error occurred while moving the card.",
      },
    };
  }
}
