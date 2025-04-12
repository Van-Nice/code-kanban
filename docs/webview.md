# Webview Frontend Documentation (`webview/`)

This document provides an overview of the source code structure for the Webview frontend, located in the `webview/` directory. This frontend is built using Svelte and TypeScript, and it communicates with the VS Code extension backend.

## Overview

The `webview/` directory contains all the code necessary to build the user interface displayed within VS Code's Webview panels (both the sidebar and the main editor panels). It uses Svelte for reactivity and component structure, TypeScript for type safety, and Tailwind CSS for styling. Rollup is used as the module bundler.

## Top-Level Files & Configuration

These files configure the build process, dependencies, and development environment for the Svelte application.

- **`package.json`**: Defines project metadata, dependencies (`dependencies`, `devDependencies`), and scripts (`scripts`) for building, developing, and serving the webview application. Key dependencies include `svelte`, `rollup`, `@rollup/plugin-typescript`, `rollup-plugin-svelte`, `tailwindcss`, `postcss`, and `uuid`.
- **`package-lock.json`**: Automatically generated file that locks the exact versions of dependencies, ensuring reproducible builds.
- **`rollup.config.js`**: Configures the Rollup module bundler.
  - Specifies the input (`src/main.ts`) and output (`../dist/webview.js`, `../dist/webview.css`).
  - Includes plugins for:
    - TypeScript compilation (`@rollup/plugin-typescript`).
    - Svelte component compilation (`rollup-plugin-svelte`), using `vitePreprocess`.
    - PostCSS processing (`rollup-plugin-postcss`) with Tailwind CSS (`@tailwindcss/postcss`) and Autoprefixer (`autoprefixer`). CSS is extracted to `webview.css`.
    - Resolving Node modules (`@rollup/plugin-node-resolve`).
    - CommonJS module conversion (`@rollup/plugin-commonjs`).
    - Minification in production (`@rollup/plugin-terser`).
    - Live reloading during development (`rollup-plugin-livereload`).
    - Serving the `public` directory during development (`serve()` function using `sirv-cli`).
- **`svelte.config.js`**: Configures the Svelte compiler and preprocessors. It primarily uses `vitePreprocess` to handle TypeScript within Svelte components and enables Svelte 5 Runes.
- **`postcss.config.mjs`**: Configures PostCSS, mainly specifying the Tailwind CSS plugin.
- **`tailwind.config.js`**: Configures Tailwind CSS, specifying content files to scan for utility classes and allowing theme extensions.
- **`tsconfig.json`**: Configures the TypeScript compiler for the webview project, specifying the target ECMAScript version, module system (`ESNext`), output directory (`../dist`), source map generation, strict type checking, and library integration (including `svelte` types).
- **`svelte-env.d.ts`**: TypeScript declaration file providing type definitions for Svelte-specific imports.
- **`.gitignore`**: Specifies intentionally untracked files (like `node_modules/`, `dist/`).
- **`node_modules/`**: Directory containing installed npm dependencies (not documented further).

## Source Code (`webview/src/`)

This directory contains the actual Svelte application code.

### Top-Level `src/` Files

- **`main.ts`**: The main entry point for the Svelte application. It imports the root component (`App.svelte`) and mounts it to the `document.body`. It also imports the global CSS file.
- **`App.svelte`**: The root Svelte component.
  - Manages the overall application state, including the currently selected board (`currentBoardId`, `currentBoardData`) and UI theme.
  - Conditionally renders either `BoardList.svelte` (when no board is selected) or `Board.svelte` (when a board is selected).
  - Initializes the VS Code API connection using `initializeVSCodeApi` from `vscodeMessaging.ts` on mount.
  - Sets up the primary message listener (`setupMessageListener`) to receive messages from the extension backend.
  - Handles specific messages relevant to the top-level view (like `BOARD_LOADED` to update `currentBoardData`, theme changes). Other messages might be handled by child components.
  - Provides functions (`handleBoardSelect`, `handleBackToBoards`) to manage navigation between the board list and individual boards, updating URL parameters accordingly.
  - Detects the initial VS Code theme (`vscode-light`, `vscode-dark`, `vscode-high-contrast`) and observes changes using a `MutationObserver`.
  - Cleans up listeners and observers on destroy.
- **`app.css`**: Contains minimal global CSS, primarily setting base styles using VS Code theme variables (e.g., `--vscode-font-family`, `--vscode-foreground`).
- **`types.ts`**: Defines or re-exports top-level types used within the webview, primarily re-exporting types from `./shared/types` and defining a basic `VSCodeMessage` interface.

### `kanban/` Subdirectory

Contains components related to the Kanban board functionality.

- **`Board.svelte`**: Component responsible for rendering a single Kanban board.
  - Receives the `board` data object as a prop.
  - Manages the state of the board's columns (`columns`).
  - Renders `ColumnComponent` for each column in the board data.
  - Handles messages from the extension that affect the currently displayed board (e.g., `COLUMN_ADDED`, `COLUMN_DELETED`, `COLUMN_UPDATED`, `CARD_ADDED`, `CARD_UPDATED`, `CARD_DELETED`, `CARD_MOVED`), updating the local `columns` state accordingly.
  - Provides callback props to `ColumnComponent` and `Card.svelte` (implicitly via `ColumnComponent`) to handle user interactions like moving cards, updating cards/columns, deleting cards/columns, and adding cards. These callbacks typically involve sending messages back to the extension using `sendMessage`.
  - Manages the state for creating a new card (modal/form visibility, input values).
- **`Column.svelte`**: Component representing a single column on the board.
  - Receives column data (`id`, `title`, `cards`, `boardId`) and interaction callbacks (`onCardMoved`, `onCardUpdated`, etc.) as props.
  - Renders `Card.svelte` for each card in its `cards` array.
  - Handles drag-and-drop operations for cards _within_ and _between_ columns (`handleDragOver`, `handleDragLeave`, `handleDrop`), calling the `onCardMoved` callback when a drop occurs.
  - Manages column title editing state (`isEditingTitle`, `editedTitle`) and calls `onUpdateColumn` when the title is saved.
  - Manages column collapsing state (`isCollapsed`).
  - Handles column deletion via a context menu and confirmation step, calling `onDeleteColumn`.
  - Provides an "Add Card" button that triggers the `onAddCard` callback.
- **`Card.svelte`**: Component representing a single card within a column.
  - Receives card data (`id`, `title`, `description`, etc.) and callbacks (`onUpdateCard`, `onDeleteCard`) as props.
  - Displays card information.
  - Handles card editing state (`isEditing`) and provides an inline form to modify title, description, labels, and assignee. Calls `onUpdateCard` when changes are saved.
  - Handles card deletion, calling `onDeleteCard`.
  - Initiates drag-and-drop operations (`handleDragStart`, `handleDragEnd`).
- **`BoardList.svelte`**: Component displayed when no specific board is selected.
  - Fetches and displays a list of all available boards by sending a `GET_BOARDS` message on mount.
  - Handles messages like `BOARDS_LOADED`, `BOARD_CREATED`, `BOARD_DELETED` to update the list.
  - Provides functionality to create a new board (shows a form, sends `CREATE_BOARD` message).
  - Provides functionality to delete boards (shows confirmation, sends `DELETE_BOARD` message).
  - Provides functionality to open a board in the editor (sends `OPEN_BOARD_IN_EDITOR` message).
  - Allows searching/filtering the list of boards.
  - Calls the `onBoardSelect` prop when a board is clicked, triggering navigation in `App.svelte`.
- **`types.ts`**: Defines or re-exports types specific to the Kanban view (currently re-exports shared types and defines a local `ColumnData` interface).

### `shared/` Subdirectory

Contains code shared between the webview and the extension backend. **Note:** Ideally, this should mirror the contents of `src/shared/` for consistency.

- **`commands.ts`**: Defines shared command constants (should be identical to `src/shared/commands.ts`).
- **`types.ts`**: Defines shared data structure interfaces (Board, Card, Column, etc.) used for communication. Should be compatible with `src/shared/types.ts`.

### `utils/` Subdirectory

Contains utility functions specifically for the webview environment.

- **`vscodeMessaging.ts`**: A crucial module for abstracting communication with the VS Code extension API.
  - `initializeVSCodeApi()`: Attempts to acquire the VS Code API instance provided by the Webview environment (`acquireVsCodeApi`).
  - `getWebviewContext()`: Retrieves the context ("sidebar" or "editor") injected by the extension.
  - `sendMessage(message)`: Sends a message object to the extension backend using the acquired `vscodeApi.postMessage`. Includes error handling and logging.
  - `setupMessageListener(callback)`: Adds a global event listener for messages coming _from_ the extension and invokes the provided callback.
  - `removeMessageListener(callback)`: Removes a previously added message listener.
  - `log(message, data?)` / `error(message, err?)`: Utility functions for logging. They send structured `log` or `error` messages back to the extension backend via `sendMessage`, allowing webview logs to appear in the extension's debug console. They also log to the browser console.

### `notepad/` and `todo/` Subdirectories

- These directories are currently empty and likely placeholders for future features.
