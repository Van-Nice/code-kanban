# Boogie - Kanban Board Extension for VS Code

Boogie is a Kanban board extension for VS Code that helps you manage tasks and workflows directly within your development environment.

## Features

- Create and manage multiple Kanban boards
- Drag and drop cards between columns
- View boards in the sidebar or in a dedicated editor tab
- Customize card details with titles, descriptions, labels, and assignees
- Collapse columns to save space
- Persistent storage of boards and cards

## Installation

1. Install the extension from the VS Code Marketplace
2. Once installed, you can access Boogie from the VS Code sidebar

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
npm run build

# Package the extension
vsce package
```
