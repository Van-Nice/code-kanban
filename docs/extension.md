# Extension Source Documentation (`src/`)

This document provides an overview of the source code structure for the VS Code extension, located in the `src/` directory.

## Overview

The `src/` directory contains the core logic for the extension's backend, including message handling, data modeling, shared types, utilities, and the main extension activation/deactivation routines.

## Top-Level Files

- **`extension.ts`**:

  - This is the main entry point for the VS Code extension.
  - It contains the `activate` and `deactivate` functions required by VS Code.
  - **`activate(context: vscode.ExtensionContext)`**:
    - Called when the extension is first activated (e.g., when a command is run or a webview is opened).
    - Stores the `extensionContext`.
    - Registers the `WebviewViewProvider` (`boogieWebview`) for the sidebar panel.
      - Configures the webview's options (enable scripts, local resources).
      - Sets the HTML content for the webview, embedding the necessary JavaScript (`webview.js`) and CSS (`webview.css`) from the `dist/` directory.
      - Instantiates a `MessageHandler` specifically for the sidebar context (`webviewContext: "sidebar"`).
      - Sets up an `onDidReceiveMessage` listener to route messages from the sidebar webview to its `MessageHandler`. Includes special handling for `executeCommand` and `addCardDirect`.
    - Registers the `boogie.openKanbanBoard` command.
      - When executed, creates a new `WebviewPanel` in the editor area.
      - Configures the panel's webview options.
      - Instantiates a separate `MessageHandler` for the editor context (`webviewContext: "editor"`).
      - Sets up an `onDidReceiveMessage` listener for the editor panel's webview.
      - Sets the HTML content for the editor webview.
    - Logs an activation message.
  - **`deactivate()`**:
    - Called when the extension is deactivated. Currently empty, but can be used for cleanup tasks.

- **`types.ts`**:
  - Defines basic data structures (`Board`, `Column`, `Card`) used primarily at the top level or potentially shared before more specific types were introduced in subdirectories. Note that more refined type definitions exist within `models/` and `shared/`.

## Subdirectories

### `handlers/`

- **Purpose**: Contains all logic for handling messages sent from the Webview views (both sidebar and editor panels) to the extension backend. It defines message structures, routes incoming messages to specific handler functions, and performs actions based on those messages (like interacting with storage).
- **Details**: For detailed documentation on the handlers, message types, and storage interaction, see [./handlers.md](./handlers.md).

### `shared/`

- **Purpose**: Contains code and type definitions intended to be shared between the VS Code extension backend (`src/`) and the Webview frontend (`webview/src/`). This ensures consistency in communication and data structures.
- **Files**:
  - `commands.ts`: Defines string constants (`Commands`) for all message command names used in communication (e.g., `GET_BOARD`, `ADD_CARD`, `COLUMN_UPDATED`). Exports a `CommandType` for type safety.
  - `message-types.ts`: Defines TypeScript interfaces for specific request and response messages that often correspond to the commands in `commands.ts` (e.g., `AddColumnMessage`, `ColumnAddedResponse`, `OpenBoardInEditorMessage`). Includes base interfaces `WebviewMessageBase` and `ResponseMessageBase`.
  - `migrations.ts`: Contains logic (`migrateData`, `MIGRATIONS` array) for handling data migrations between different storage schema versions. Includes functions to transform older data formats to the current `StorageData` structure defined in `shared/types.ts`.
  - `types.ts`: Defines core data structure interfaces (`Board`, `Column`, `Card`, `BoardMetadata`, `ColumnData`, `CardData`) used for **storage** and **communication**. Also defines `StorageData` (shape of persisted data), type guards (`isBoardMetadata`, etc.), migration types (`Migration`, `MigrationFunction`), and storage constants (`STORAGE_KEYS`, `CURRENT_STORAGE_VERSION`).

### `models/`

- **Purpose**: Defines the core data models used _internally_ within the extension backend logic. These models often use `Date` objects, whereas shared types might use ISO strings for serialization. It also defines the storage interface and adapter functions.
- **Files**:
  - `board.ts`: Defines the primary internal models: `Board`, `Column`, `Card`. These interfaces represent the data structures used within the extension's business logic, often including `Date` objects and potentially nested structures.
  - `storage.ts`: Defines the `Storage` interface. This acts as a contract for any class that provides data persistence, specifying the methods required for CRUD operations on boards, columns, and cards (e.g., `saveBoard`, `getBoard`, `moveCard`).
  - `adapters.ts`: Provides functions to convert between different model representations (e.g., `convertToApiBoard` from shared type to model type, `convertToStorageBoard` from model type to shared type). These are used when reading from/writing to storage or sending/receiving data via messages.

### `utils/`

- **Purpose**: Contains general utility functions and type conversion helpers used across the extension backend.
- **Files**:
  - `type-conversions.ts`: Provides a set of functions specifically designed to convert between the various type definitions used in different parts of the codebase (handler types, model types, shared types). Examples include `convertToModelBoard`, `convertToSharedColumn`. This centralizes potentially complex or repetitive conversion logic.
  - `README.md`: Documentation specific to the utilities.

### `test/`

- **Purpose**: Contains automated tests for the extension, including unit tests and end-to-end tests. Uses frameworks like Mocha.
- **Files**: Includes test runners (`runTest.ts`), configuration (`tsconfig.json`), test suites (`suite/`, `*.test.ts`), and testing utilities (`test-utils.ts`).
