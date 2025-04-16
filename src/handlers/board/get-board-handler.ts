import { GetBoardMessage, BoardResponse } from "../messages";
import type { ColumnWithCollapsedState } from "../messages";
import { HandlerContext } from "../message-handler";
import { Commands } from "../../shared/commands";
import type {
  Board as SharedBoard,
  Column as SharedColumn,
  Card as SharedCard,
} from "../../shared/types";
import type {
  Board as ModelBoard,
  Column as ModelColumn,
  Card as ModelCard,
} from "../../models/board";

// Helper function: Convert Model types to Shared types including collapsed state
function convertToSharedBoard(
  board: ModelBoard,
  collapsedStates: { [columnId: string]: boolean }
): SharedBoard {
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    // Map ModelColumn[] to ColumnWithCollapsedState[] (which extends SharedColumn)
    columns: (board.columns || []).map(
      (col: ModelColumn): ColumnWithCollapsedState => {
        const isCollapsed = collapsedStates[col.id] ?? false;
        return {
          // Properties from SharedColumn
          id: col.id,
          title: col.title,
          order: col.order,
          createdAt: col.createdAt.toISOString(), // String timestamp
          updatedAt: col.updatedAt.toISOString(), // String timestamp
          boardId: board.id,
          cardIds: (col.cards || []).map((card) => card.id),
          cards: (col.cards || []).map(
            // Map ModelCard to SharedCard
            (card: ModelCard): SharedCard => ({
              id: card.id,
              title: card.title,
              description: card.description,
              labels: card.labels,
              assignee: card.assignee,
              columnId: card.columnId,
              boardId: card.boardId,
              order: card.order,
              createdAt: card.createdAt.toISOString(), // String timestamp
              updatedAt: card.updatedAt.toISOString(), // String timestamp
            })
          ),
          // Added property
          collapsed: isCollapsed,
        };
      }
    ),
  };
}

export async function handleGetBoard(
  message: GetBoardMessage,
  context: HandlerContext
) /*: Promise<BoardResponse>*/ {
  // Return type annotation removed temporarily
  const { storage, logger } = context;

  if (!message.data?.boardId) {
    logger.error("No board ID provided in message");
    return {
      command: Commands.BOARD_LOADED,
      data: {
        success: false,
        error: "No board ID provided",
      },
    };
  }

  try {
    logger.debug(`Requesting board with ID ${message.data.boardId}`);
    const board: ModelBoard | null = await storage.getBoard(
      message.data.boardId
    );

    if (board) {
      logger.debug(`Found board: ${board.title}`);
      const collapsedStates = await storage.getColumnCollapsedStates(
        message.data.boardId
      );
      logger.debug(
        `Fetched collapsed states for board ${message.data.boardId}:`,
        collapsedStates
      );

      const sharedBoard: SharedBoard = convertToSharedBoard(
        board,
        collapsedStates
      );

      // Return the correct response structure expected by App.svelte
      return {
        command: Commands.BOARD_LOADED, // Use the enum value
        data: {
          success: true,
          board: sharedBoard, // Nested board data
        },
      };
    } else {
      logger.error(`Board with ID ${message.data.boardId} not found`);
      return {
        command: Commands.BOARD_LOADED,
        data: {
          success: false,
          error: `Board with ID ${message.data.boardId} not found`,
        },
      };
    }
  } catch (error: unknown) {
    // Type catch variable
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `Error loading board ${message.data.boardId}: ${errorMessage}`
    );
    return {
      command: Commands.BOARD_LOADED,
      data: {
        success: false,
        error: `Error loading board: ${errorMessage}`,
      },
    };
  }
}
