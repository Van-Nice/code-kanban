# Handlers Documentation (`src/handlers/`)

This directory contains the message handlers responsible for processing communication between the VS Code extension backend and the Webview frontend(s). It defines message structures, provides core handling logic, and implements specific actions related to boards, columns, and cards.

## Top-Level Files

These files provide foundational types, utilities, and the main message routing mechanism.

- **`index.ts`**:

  - Serves as the central export point for all handler functions.
  - Imports handlers from subdirectories (`board/`, `card/`, `column/`) and other top-level handler files.
  - Makes handlers easily accessible to the main extension logic that invokes them.

- **`message-handler.ts`**:

  - Defines the core `MessageHandler` class. This class is instantiated with references to the `vscode.Webview`, `vscode.ExtensionContext`, and a `webviewContext` string (e.g., "sidebar").
  - Its primary method, `handleMessage(message: WebviewMessage)`, receives messages from the webview.
  - It uses a `handlerMap` (populated with handlers exported from `index.ts`) to look up the appropriate handler based on the `message.command`.
  - It creates a `HandlerContext` object containing shared resources (`BoardStorage`, `Logger`, `vscode.Webview`, `vscode.ExtensionContext`, `webviewContext`) and passes it to the invoked handler.
  - Handles sending responses returned by handlers back to the webview via `sendMessage`.
  - Includes robust error handling and logging.
  - Defines the `HandlerContext` interface and a generic `HandlerFunction` type.
  - Also exports `handleExecuteCommand`, likely for generic command execution requests.

- **`messages.ts`**:

  - Defines TypeScript interfaces for all messages exchanged between the extension and webview(s).
  - `WebviewMessageBase`: Base interface for messages originating from the webview.
  - Specific request message interfaces (e.g., `GetBoardMessage`, `AddCardMessage`, `UpdateColumnMessage`).
  - `WebviewMessage`: A union type encompassing all possible request messages.
  - `ResponseMessageBase`: Base interface for messages sent back to the webview.
  - Specific response message interfaces (e.g., `BoardLoadedResponse`, `CardAddedResponse`, `ColumnDeletedResponse`).
  - `ResponseMessage`: A union type encompassing all possible response messages.
  - This file acts as the contract for communication.

- **`types.ts`**:

  - Re-exports core data types (`Board`, `Card`, `Column`, etc.) from the shared types definition (`src/shared/types.ts`).
  - Defines handler-specific utility types:
    - `HandlerError`: Interface for structured error objects used within handlers.
    - `HandlerResponse<T>`: Generic interface for handler responses, wrapping data or an error object.

- **`logger.ts`**:

  - Provides a `Logger` class for standardized logging within the extension.
  - Wraps `console.log`, `console.error`, etc.
  - Includes methods like `log`, `debug`, `error`, `info`.
  - Supports conditional debug logging based on environment variables or constructor options.

- **`log-handler.ts`**:

  - Exports `handleLog`.
  - Receives a `LogMessage` from the webview.
  - Uses the `Logger` instance from the `HandlerContext` to log the message content. Useful for relaying logs from the webview environment to the extension's output channel.

- **`error-handler.ts`**:

  - Exports `handleError`.
  - Receives an `ErrorMessage` from the webview.
  - Uses the `Logger` instance from the `HandlerContext` to log the error details received from the webview.

- **`show-error-message-handler.ts`**:

  - Exports `handleShowErrorMessage`.
  - Receives a `ShowErrorMessageMessage`.
  - Uses the `vscode.window.showErrorMessage` API to display a native VS Code error notification to the user with the provided message.
  - Handles potential errors during the API call.
  - Returns a `ShowErrorMessageResponse` indicating success or failure.
  - Includes logic to bypass the VS Code API call in a test context.

- **`utils.ts`**:

  - Contains general utility functions used by handlers.
  - Currently includes `sanitizeString(str: string, maxLength: number): string` which truncates a string if it exceeds the specified maximum length.

- **`direct-add-card.ts`**:
  - Exports `directAddCard`.
  - Provides a function to add a card directly, outside the standard webview message flow.
  - Likely intended for use cases like adding a card via a VS Code command or CodeLens action.
  - Takes card details, `vscode.ExtensionContext`, and `vscode.Webview` as arguments.
  - Interacts directly with `BoardStorage` to save the card.
  - Posts a `Commands.CARD_ADDED` message back to the webview upon completion or error.

## Board Handlers (`src/handlers/board/`)

This subdirectory contains handlers specifically for managing boards and their storage.

- **`board.ts`**:

  - Defines local `Board`, `Column`, and `Card` interfaces as used within the handler logic. These might differ slightly from the shared types or storage types (e.g., containing nested objects rather than just IDs).

- **`storage-types.ts`**:

  - Defines types directly related to how data is structured in persistent storage (`vscode.ExtensionContext.globalState`).
  - `STORAGE_KEYS`: Constants object mapping logical data types (boards, columns, cards, version) to their actual keys in `globalState`.
  - `CURRENT_STORAGE_VERSION`: The current version string for the storage schema, used for migrations.
  - `StorageData`: Interface defining the shape of the raw data maps loaded from storage.
  - Re-exports `BoardMetadata`, `ColumnData`, `CardData` from shared types.

- **`board-storage.ts`**:

  - Implements the `BoardStorage` class, the primary interface for interacting with persisted board data.
  - Uses `vscode.ExtensionContext` to access `globalState` for persistence.
  - Handles loading data (`loadRawData`), converting it into usable Map structures.
  - Handles saving data (`saveData`), converting Maps back into arrays suitable for `globalState`.
  - Provides methods for CRUD operations on boards, columns, and cards (e.g., `getBoards`, `saveBoard`, `deleteBoard`, `getColumns`, `saveColumn`, `saveCard`, `deleteCard`, `moveCard`).
  - Includes logic for storage initialization (`initializeStorage`), version checking, and data migration (`migrateData`).
  - Implements a save queue (`saveQueue`, `processSaveQueue`) to prevent race conditions during concurrent save operations.
  - Contains data validation logic (`validateStorageData`) and type conversion helpers (e.g., `convertToApiBoard`, `convertToStorageBoard`).

- **`get-boards-handler.ts`**:

  - Exports `handleGetBoards`.
  - Triggered by a `getBoards` command.
  - Calls `storage.getBoards()` to retrieve metadata for all boards.
  - Returns a `BoardsLoadedResponse` containing the list of boards or an error.

- **`get-board-handler.ts`**:

  - Exports `handleGetBoard`.
  - Triggered by a `getBoard` command with a `boardId`.
  - Calls `storage.getBoard(boardId)` to retrieve the full details of a specific board, including its columns and cards.
  - Converts the retrieved data (likely using model types with Date objects) into the shared types expected by the webview (with ISO string dates).
  - Returns a `BoardLoadedResponse` (using the `Commands.BOARD_LOADED` command identifier) containing the full board data or an error.

- **`create-board-handler.ts`**:

  - Exports `handleCreateBoard`.
  - Triggered by a `createBoard` command with board details (title, description).
  - Generates a unique ID (`uuidv4`) if not provided.
  - Creates a new board object, including default columns ("To Do", "In Progress", "Done").
  - Calls `storage.saveBoard()` to persist the new board.
  - Returns a `BoardCreatedResponse` with the newly created board data or an error.

- **`update-board-handler.ts`**:

  - Exports `handleUpdateBoard`.
  - Triggered by an `updateBoard` command with `boardId` and new `title`.
  - Retrieves the board using `storage.getBoard()`.
  - Updates the board's title and `updatedAt` timestamp.
  - Calls `storage.saveBoard()` to persist the changes.
  - Returns a `BoardUpdatedResponse` with the updated board data or an error.

- **`delete-board-handler.ts`**:

  - Exports `handleDeleteBoard`.
  - Triggered by a `deleteBoard` command with a `boardId`.
  - Calls `storage.deleteBoard(boardId)` to remove the board and associated data from storage.
  - Returns a `BoardDeletedResponse` confirming the deletion (with the `boardId`) or an error.

- **`open-board-in-editor-handler.ts`**:

  - Exports `handleOpenBoardInEditor`.
  - Triggered by an `openBoardInEditor` command (`Commands.OPEN_BOARD_IN_EDITOR`) with a `boardId`.
  - Verifies the board exists using `storage.getBoard()`.
  - Executes the VS Code command `boogie.openBoardInEditor` with the `boardId`. This command is responsible for actually creating and showing the WebviewPanel for the board editor.
  - Returns an `OpenBoardInEditorResponse` indicating if the command was successfully executed.

- **`board-loaded-handler.ts`**:
  - Exports `handleBoardLoaded`.
  - Handles the `boardLoaded` message sent _from_ the webview _to_ the extension.
  - This message serves as an acknowledgment that the webview has received and finished processing the data for a specific board sent by `handleGetBoard`.
  - It logs that the board has loaded in the webview.
  - It does _not_ send a response back to the webview.

## Card Handlers (`src/handlers/card/`)

This subdirectory contains handlers specifically for managing cards within columns.

- **`add-card-handler.ts`**:

  - Exports `handleAddCard`.
  - Triggered by an `addCard` command (`Commands.ADD_CARD`) with `boardId`, `columnId`, `title`, and optional `description`.
  - Validates input and checks if the board exists.
  - Creates a new card object with a unique ID (`uuidv4`) and other details.
  - Calls `storage.saveCard()` to persist the new card.
  - Returns a `CardAddedResponse` containing the new card data or an error.

- **`update-card-handler.ts`**:

  - Exports `handleUpdateCard`.
  - Triggered by an `updateCard` command with `boardId`, `columnId`, `cardId`, and updated `title` and `description`.
  - Retrieves the board data using `storage.getBoard()`.
  - Locates the specific card within the board's columns.
  - Updates the card's properties (title, description, `updatedAt`). Uses `sanitizeString`.
  - Calls `storage.saveBoard()` to persist the changes to the entire board (as cards are nested).
  - Returns a `CardUpdatedResponse` containing the updated card data or an error.

- **`delete-card-handler.ts`**:

  - Exports `handleDeleteCard`.
  - Triggered by a `deleteCard` command with `boardId`, `columnId`, and `cardId`.
  - Retrieves the board data.
  - Locates the specific card within the board's columns.
  - Removes the card from the column's `cards` array.
  - Calls `storage.saveBoard()` to persist the change.
  - Returns a `CardDeletedResponse` confirming the deletion (with `cardId` and `columnId`) or an error.

- **`move-card-handler.ts`**:
  - Exports `handleMoveCard`.
  - Triggered by a `moveCard` command with `boardId`, `cardId`, `fromColumnId`, `toColumnId`, and optional `position`.
  - Calls `storage.moveCard()` which encapsulates the logic of removing the card from the source column, adding it to the destination column at the correct position, and updating card orders within both columns.
  - Retrieves the fully updated board state using `storage.getBoard()`.
  - Returns a `CardMovedResponse` containing confirmation and the `newColumns` array representing the updated state of _all_ columns on the board, allowing the webview to completely re-render the affected areas.

## Column Handlers (`src/handlers/column/`)

This subdirectory contains handlers specifically for managing columns within boards.

- **`add-column-handler.ts`**:

  - Exports `handleAddColumn`.
  - Triggered by an `addColumn` command (`Commands.ADD_COLUMN`) with `boardId` and `title`.
  - Retrieves the board using `storage.getBoard()`.
  - Creates a new column object with a unique ID (`uuidv4`), assigns it the next order index.
  - Adds the new column to the board's `columns` array.
  - Calls `storage.saveBoard()` to persist the change.
  - Returns a `ColumnAddedResponse` containing the new column data or an error.

- **`update-column-handler.ts`**:

  - Exports `handleUpdateColumn`.
  - Triggered by an `updateColumn` command (`Commands.UPDATE_COLUMN`) with `boardId`, `columnId`, and new `title`.
  - Retrieves the board data.
  - Locates the specific column within the board's `columns` array.
  - Updates the column's `title` (using `sanitizeString`) and `updatedAt` timestamp.
  - Calls `storage.saveBoard()` to persist the change.
  - Returns a `ColumnResponse` (using `Commands.COLUMN_UPDATED` command) containing the updated column data or an error.

- **`delete-column-handler.ts`**:
  - Exports `handleDeleteColumn`.
  - Triggered by a `deleteColumn` command (`Commands.DELETE_COLUMN`) with `boardId` and `columnId`.
  - Retrieves the board data.
  - Locates the specific column.
  - Removes the column from the board's `columns` array.
  - **Important**: Re-calculates the `order` property for the remaining columns.
  - Calls `storage.saveBoard()` to persist the changes.
  - Returns a `ColumnDeletedResponse` confirming the deletion (with `columnId`) or an error.
