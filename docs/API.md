# Code Kanban REST API

This document outlines the REST API endpoints for the Code Kanban extension.

## Enabling the API

To enable the API, add the following to your VS Code `settings.json` file:

```json
"codeKanban.api.enabled": true,
"codeKanban.api.port": 3000
```

---

## Boards

### `GET /boards`

Retrieves a list of all Kanban boards.

**Response:**

```json
[
  {
    "id": "board-1",
    "title": "Project Phoenix",
    "description": "The main board for the Phoenix project.",
    "createdAt": "2025-10-04T01:15:44.308Z",
    "updatedAt": "2025-10-04T01:15:44.308Z",
    "columns": []
  }
]
```

### `GET /boards/:boardId`

Retrieves a single board by its ID, including all its columns and cards.

**Parameters:**

- `boardId` (string, required): The ID of the board to retrieve.

**Response:**

```json
{
  "id": "board-1",
  "title": "Project Phoenix",
  "description": "The main board for the Phoenix project.",
  "createdAt": "2025-10-04T01:15:44.308Z",
  "updatedAt": "2025-10-04T01:15:44.308Z",
  "columns": [
    {
      "id": "col-1",
      "title": "To Do",
      "order": 0,
      "createdAt": "2025-10-04T01:15:44.308Z",
      "updatedAt": "2025-10-04T01:15:44.308Z",
      "boardId": "board-1",
      "cards": []
    }
  ]
}
```

### `POST /boards`

Creates a new board.

**Request Body:**

```json
{
  "title": "New Project Board",
  "description": "A description for the new board."
}
```

**Response:**
Returns the newly created board object.

### `PUT /boards/:boardId`

Updates an existing board.

**Parameters:**

- `boardId` (string, required): The ID of the board to update.

**Request Body:**

```json
{
  "title": "Updated Project Board",
  "description": "An updated description."
}
```

**Response:**
Returns the updated board object.

### `DELETE /boards/:boardId`

Deletes a board and all its associated columns and cards.

**Parameters:**

- `boardId` (string, required): The ID of the board to delete.

**Response:**
`204 No Content`

---

## Columns

### `POST /boards/:boardId/columns`

Adds a new column to a specific board.

**Parameters:**

- `boardId` (string, required): The ID of the board to add the column to.

**Request Body:**

```json
{
  "title": "In Progress"
}
```

**Response:**
Returns the newly created column object.

### `PUT /columns/:columnId`

Updates an existing column.

**Parameters:**

- `columnId` (string, required): The ID of the column to update.

**Request Body:**

```json
{
  "title": "In Review"
}
```

**Response:**
Returns the updated column object.

### `DELETE /columns/:columnId`

Deletes a column.

**Parameters:**

- `columnId` (string, required): The ID of the column to delete.

**Response:**
`204 No Content`

---

## Cards

### `POST /columns/:columnId/cards`

Adds a new card to a specific column.

**Parameters:**

- `columnId` (string, required): The ID of the column to add the card to.

**Request Body:**

```json
{
  "title": "Implement user authentication",
  "description": "Set up Passport.js with a local strategy.",
  "tags": ["auth", "backend"]
}
```

**Response:**
Returns the newly created card object.

### `PUT /cards/:cardId`

Updates an existing card.

**Parameters:**

- `cardId` (string, required): The ID of the card to update.

**Request Body:**

```json
{
  "title": "Implement JWT-based user authentication",
  "description": "Update the auth system to use JSON Web Tokens.",
  "tags": ["auth", "jwt", "backend"]
}
```

**Response:**
Returns the updated card object.

### `PATCH /cards/:cardId/move`

Moves a card to a different column and/or changes its order within a column.

**Parameters:**

- `cardId` (string, required): The ID of the card to move.

**Request Body:**

```json
{
  "newColumnId": "col-2",
  "newOrder": 0
}
```

**Response:**
Returns the updated card object.

### `DELETE /cards/:cardId`

Deletes a card.

**Parameters:**

- `cardId` (string, required): The ID of the card to delete.

**Response:**
`204 No Content`
