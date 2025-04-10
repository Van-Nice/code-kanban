import { AddCardMessage, CardResponse } from "../messages";
import { HandlerContext } from "../message-handler";
import { Board, Card } from "../types";

/**
 * Validates the input message for card addition
 */
function validateInput(
  message: AddCardMessage,
  logger: any
): CardResponse | null {
  if (
    !message.data?.boardId ||
    !message.data?.columnId ||
    !message.data?.card
  ) {
    console.log("ADD CARD - Missing required fields for card addition");
    return {
      command: "cardAdded",
      data: {
        success: false,
        error: "Missing required fields: boardId, columnId, or card data",
      },
    };
  }
  return null;
}

export async function handleAddCard(
  message: AddCardMessage,
  context: HandlerContext
): Promise<CardResponse> {
  const { storage, logger } = context;

  // Check for required fields
  const validationError = validateInput(message, logger);
  if (validationError) return validationError;

  try {
    console.log("ADD CARD - Processing card addition request", {
      boardId: message.data.boardId,
      columnId: message.data.columnId,
      cardId: message.data.card?.id,
      cardTitle: message.data.card?.title,
    });

    // Prepare sanitized card data
    const sanitizedCard: Card = {
      ...message.data.card,
      title: message.data.card.title?.slice(0, 100) || "",
      description: message.data.card.description?.slice(0, 1000) || "",
      labels: Array.isArray(message.data.card.labels)
        ? message.data.card.labels
            .slice(0, 10)
            .map((label: string) =>
              typeof label === "string" ? label.slice(0, 50) : ""
            )
        : [],
      assignee: message.data.card.assignee?.slice(0, 100) || "",
      boardId: message.data.boardId,
      columnId: message.data.columnId,
      createdAt: message.data.card.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    console.log("ADD CARD - Sanitized card data:", sanitizedCard);

    // Fetch and locate the target board
    const boards = await storage.getBoards();
    console.log(`ADD CARD - Found ${boards.length} boards in storage`);

    const board = boards.find((b: Board) => b.id === message.data.boardId);
    if (!board) {
      console.log(`ADD CARD - ERROR: Board ${message.data.boardId} not found`);
      return {
        command: "cardAdded",
        data: { success: false, error: "Board not found" },
      };
    }
    console.log(
      `ADD CARD - Found board: ${board.title} with ${board.columns.length} columns`
    );

    // Locate the target column
    const column = board.columns.find(
      (c: any) => c.id === message.data.columnId
    );
    if (!column) {
      console.log(
        `ADD CARD - ERROR: Column ${message.data.columnId} not found`
      );
      return {
        command: "cardAdded",
        data: { success: false, error: "Column not found" },
      };
    }
    console.log(
      `ADD CARD - Found column: ${column.title} with ${column.cards.length} cards`
    );

    // Add card with default order if unset
    sanitizedCard.order = sanitizedCard.order ?? column.cards.length;
    column.cards.push(sanitizedCard);
    board.updatedAt = new Date().toISOString();
    console.log(
      `ADD CARD - Added card to column. Column now has ${column.cards.length} cards`
    );

    // Save updated data
    console.log(`ADD CARD - Creating deep copy of boards for saving`);
    const updatedBoards = JSON.parse(JSON.stringify(boards));

    console.log(`ADD CARD - Saving boards to storage`);
    await storage.saveBoards(updatedBoards);
    console.log(`ADD CARD - Boards saved successfully`);

    // Verify the save was successful by checking storage
    const verifyBoards = storage.getBoards();
    const verifyBoard = verifyBoards.find(
      (b: any) => b.id === message.data.boardId
    );
    const verifyColumn = verifyBoard?.columns.find(
      (c: any) => c.id === message.data.columnId
    );
    const verifyCard = verifyColumn?.cards.find(
      (c: any) => c.id === sanitizedCard.id
    );

    console.log(
      `ADD CARD - Verification: Card exists after save: ${Boolean(verifyCard)}`
    );
    if (verifyCard) {
      console.log(`ADD CARD - Verification successful. Card saved correctly:`, {
        id: verifyCard.id,
        title: verifyCard.title,
        columnId: verifyCard.columnId,
      });
    } else {
      console.log(
        `ADD CARD - WARNING: Card verification failed! Card may not have been saved properly.`
      );
    }

    // Verify and return success
    return {
      command: "cardAdded",
      data: {
        success: true,
        card: sanitizedCard,
        columnId: message.data.columnId,
      },
    };
  } catch (error: unknown) {
    console.log(`ADD CARD - ERROR: Error adding card:`, error);
    return {
      command: "cardAdded",
      data: {
        success: false,
        error: `Failed to add card: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}
