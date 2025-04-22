# Code Kanban - Kanban Board Extension for VS Code

Code Kanban is a Kanban board extension for VS Code that helps you manage tasks and workflows directly within your development environment.

## Features

- Create, edit, and delete boards, columns, and cards.
- Drag and drop cards between columns and reorder columns/cards.
- Customize card details with titles, descriptions, and tags.
- View and manage your Kanban boards directly within VS Code's sidebar or editor.
- Collapsed column state persistence.

## Prerequisites

- Visual Studio Code 1.80.0 or later

## Installation

1. Install Code Kanban from the VS Code Marketplace
2. Once installed, you can access Code Kanban from the VS Code sidebar (look for the Code Kanban icon)

## Usage

### Creating a Board

1. Click the "Create New Board" button
2. Enter a title and optional description
3. Click "Create"

### Managing Cards

- Click the "+" button on a column to add a new card
- Click on a card to edit its details
- Drag and drop cards between columns
- Use the "↑" and "↓" buttons to collapse/expand columns

### Viewing Boards

- View boards in the sidebar for quick access
- Open boards in a dedicated editor tab for a larger view by clicking the "Open in editor" button

## Development

This extension is built using:

- TypeScript
- Svelte
- VS Code Webview API

### Building the Extension

```bash
# Install dependencies
npm install

# Build the extension
npm run compile-all

# Package the extension
vsce package
```

Contributions are welcome! Please refer to the CONTRIBUTING.md file for guidelines.

## License

Code Kanban is licensed under the [MIT License](LICENSE).
