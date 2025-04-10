# Kanban Board Component Architecture

## Component Hierarchy

```
BoardList.svelte
└── Board.svelte
    └── Column.svelte
        └── Card.svelte
```

## Component Responsibilities

### 1. BoardList.svelte

- **Primary Role**: Board selection and management
- **Key Features**:

  - Displays list of all boards
  - Board creation/deletion
  - Board search functionality
  - Board selection for viewing

- **Interaction with Board.svelte**:
  ```typescript
  // Board selection
  onBoardSelect(boardId: string) => void
  ```
  - Triggers when a board is selected
  - Passes the selected board ID to parent component

### 2. Board.svelte

- **Primary Role**: Board state management and coordination
- **Key Features**:

  - Manages board state and snapshots
  - Coordinates between columns
  - Handles board-level operations
  - Communicates with extension for persistence

- **Interaction with Column.svelte**:
  ```typescript
  // Column operations
  onCardMoved: (data: { cardId, fromColumnId, toColumnId, position }) => void
  onCardUpdated: (card: CardType) => void
  onCardDeleted: (cardId: string) => void
  onAddCard: (columnId: string) => void
  onUpdateColumn: (columnId: string) => void
  onDeleteColumn: (columnId: string) => void
  ```
  - Receives and processes all column-level events
  - Maintains board state consistency
  - Handles persistence through extension communication

### 3. Column.svelte

- **Primary Role**: Column management and card layout
- **Key Features**:

  - Manages column state
  - Handles drag and drop between cards
  - Coordinates card layout
  - Passes through card events

- **Interaction with Card.svelte**:
  ```svelte
  <Card
    {...card}
    columnId={id}
    onUpdateCard={(updatedCard) => {
      cardsList = cardsList.map(c => c.id === updatedCard.id ? updatedCard : c);
      onCardUpdated(updatedCard);
    }}
    onDeleteCard={(cardId) => {
      cardsList = cardsList.filter(c => c.id !== cardId);
      onCardDeleted(cardId);
    }}
  />
  ```
  - Passes card props and callbacks
  - Maintains column's card list
  - Coordinates drag and drop

### 4. Card.svelte

- **Primary Role**: Card state and interaction management
- **Key Features**:

  - Manages card editing state
  - Handles card interactions
  - Manages card data
  - Provides drag functionality

- **Interaction with Column.svelte**:
  ```typescript
  // Card operations
  onUpdateCard: (card: CardType) => void
  onDeleteCard: (cardId: string) => void
  ```
  - Emits updates and deletions to parent column
  - Handles all internal card interactions

## Data Flow

### 1. Downward Flow (Props)

```
BoardList → Board → Column → Card
```

- Board data flows down through props
- Each component receives only the data it needs

### 2. Upward Flow (Events)

```
Card → Column → Board → BoardList
```

- Events bubble up through callbacks
- Each component processes events relevant to its scope

## Event Handling

### 1. Card Events

- **Handled by Card.svelte**:

  - Edit state
  - Click interactions
  - Form submissions
  - Label management

- **Delegated to Column.svelte**:
  - Card deletion
  - Drag and drop coordination

### 2. Column Events

- **Handled by Column.svelte**:

  - Column title editing
  - Collapse/expand
  - Card layout
  - Drag and drop targets

- **Delegated to Board.svelte**:
  - Column updates
  - Column deletion
  - Card movement between columns

### 3. Board Events

- **Handled by Board.svelte**:

  - Board state management
  - Snapshot creation
  - Extension communication

- **Delegated to BoardList.svelte**:
  - Board selection
  - Board creation/deletion

## State Management

### 1. Card State

- Managed internally by Card.svelte
- Includes:
  - Edit mode
  - Form values
  - Drag state

### 2. Column State

- Managed by Column.svelte
- Includes:
  - Card list
  - Collapse state
  - Drag target state

### 3. Board State

- Managed by Board.svelte
- Includes:
  - Column list
  - Board snapshots
  - Loading state

### 4. BoardList State

- Managed by BoardList.svelte
- Includes:
  - Board list
  - Search state
  - Creation state

## Communication with Extension

### 1. BoardList → Extension

- Board creation
- Board deletion
- Board list retrieval

### 2. Board → Extension

- Board updates
- Card operations
- Column operations

### 3. Card → Extension

- Card updates
- Card deletion

This architecture follows the principle of component encapsulation, where each component manages its own state and interactions while communicating with its parent through well-defined interfaces.
