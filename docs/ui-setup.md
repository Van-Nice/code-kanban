# Kanban Board Proof of Concept Documentation

This document provides a detailed explanation of the logic behind a frontend-only Kanban board proof of concept, implemented with Svelte 5 and Tailwind CSS 4. It focuses on the application's core functionality, state management, component interactions, and user interactivity, assuming the tech stack and configurations are already in place.

---

## Table of Contents
1. [Data Structure](#data-structure)
2. [Component Architecture](#component-architecture)
   - [KanbanBoard Component](#kanbanboard-component)
   - [Column Component](#column-component)
   - [Card Component](#card-component)
3. [Drag-and-Drop Functionality](#drag-and-drop-functionality)
4. [Interactivity](#interactivity)
5. [Styling Approach](#styling-approach)
6. [Application Assembly](#application-assembly)
7. [Summary](#summary)

---

## Data Structure

The Kanban board's state is managed centrally using Svelte 5's reactive `$state` rune, which ensures that any changes to the data automatically trigger UI updates. The data structure is an array of column objects, each containing an array of card objects.

- **Columns**: Represented as objects with:
  - `id`: A unique integer identifier.
  - `name`: A string describing the column (e.g., "To Do", "In Progress").
  - `cards`: An array of card objects.
- **Cards**: Represented as objects with:
  - `id`: A unique integer identifier.
  - `title`: A string describing the task.

To generate unique IDs for new columns and cards, two counters—`nextColumnId` and `nextCardId`—are maintained and incremented each time a new element is added. This ensures no ID collisions occur, which is critical for identifying elements during state updates and drag-and-drop operations.

**Initial State Example**:
```javascript
let nextCardId = 3;
let nextColumnId = 4;
let columns = $state([
  { id: 1, name: 'To Do', cards: [{ id: 1, title: 'Task 1' }, { id: 2, title: 'Task 2' }] },
  { id: 2, name: 'In Progress', cards: [] },
  { id: 3, name: 'Done', cards: [] }
]);
```

**Logic Behind the Structure**:
- The nested structure (columns containing cards) mirrors the visual hierarchy of a Kanban board, making it intuitive to render and manipulate.
- Using integers for IDs simplifies lookups and comparisons, which are frequent during card movements and state updates.
- The `$state` rune encapsulates the entire data structure, ensuring that any modification—whether adding a card, moving a card, or adding a column—triggers a reactive update across all dependent components.

---

## Component Architecture

The application is split into three primary components: `KanbanBoard`, `Column`, and `Card`. This modular design separates concerns, making the logic easier to reason about and maintain.

### KanbanBoard Component

**Purpose**: Acts as the root component, managing the global state and orchestrating the rendering of all columns.

**Key Responsibilities**:
- Maintains the reactive `columns` array and ID counters.
- Defines core logic for adding cards, moving cards between columns, and optionally adding new columns.
- Passes data and callback functions to `Column` components.

**Core Logic**:
- **Adding a Card**:
  - The `addCardToColumn` function accepts a `columnId` and a `title`.
  - It locates the target column using `map`, creates a new card with the next available `nextCardId`, and appends it to the column's `cards` array.
  - The update is immutable (using spread operators) to preserve reactivity and avoid mutating the original state directly.
  - **Why Immutable Updates?**: Svelte 5’s reactivity relies on assignment rather than mutation. By creating a new array, the `$state` rune detects the change and updates the UI.

- **Moving a Card**:
  - The `moveCard` function takes `fromColumnId`, `toColumnId`, and `cardId` as parameters.
  - It first checks if the source and target columns are the same (no action needed if true).
  - It finds the source column and the card to move, removes the card from the source column’s `cards` array, and adds it to the target column’s `cards` array.
  - The update uses `map` and `filter` to ensure immutability, preserving the original structure while reflecting the new state.
  - **Why Check for Same Column?**: This prevents unnecessary state updates, optimizing performance for a common edge case where a user drops a card back into its original column.

- **Adding a Column**:
  - The `addColumn` function creates a new column with a unique `nextColumnId` and a default name, appending it to the `columns` array.
  - This feature is optional but enhances flexibility, allowing users to expand the board dynamically.

**Implementation Example**:
```typescript
<script>
  let nextCardId = 3;
  let nextColumnId = 4;
  let columns = $state([...]); // Initial state as above

  function addCardToColumn(columnId, title) {
    columns = columns.map(col => {
      if (col.id === columnId) {
        const newCard = { id: nextCardId++, title };
        return { ...col, cards: [...col.cards, newCard] };
      }
      return col;
    });
  }

  function moveCard(fromColumnId, toColumnId, cardId) {
    if (fromColumnId === toColumnId) return;
    const fromColumn = columns.find(col => col.id === fromColumnId);
    const card = fromColumn.cards.find(c => c.id === cardId);
    if (card) {
      columns = columns.map(col => {
        if (col.id === fromColumnId) {
          return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
        }
        if (col.id === toColumnId) {
          return { ...col, cards: [...col.cards, card] };
        }
        return col;
      });
    }
  }

  function addColumn() {
    const newColumn = { id: nextColumnId++, name: 'New Column', cards: [] };
    columns = [...columns, newColumn];
  }
</script>

<div class="flex space-x-4 p-4">
  {#each columns as column}
    <Column {column} addCard={addCardToColumn} moveCard={moveCard} />
  {/each}
</div>
<button on:click={addColumn} class="mt-4 bg-blue-500 text-white p-2 rounded">Add Column</button>
```

### Column Component

**Purpose**: Represents an individual column, rendering its cards and handling user inputs for adding cards and receiving dropped cards.

**Key Responsibilities**:
- Displays the column name and its cards using the `Card` component.
- Provides an input field and button to add new cards.
- Implements drag-and-drop event handlers to accept cards from other columns.

**Core Logic**:
- **Adding a Card**:
  - The `handleAddCard` function validates the input (ensuring it’s not empty), then calls the `addCard` prop function with the column’s ID and the new title.
  - The input is cleared after submission to prepare for the next entry.
  - **Why Validate Input?**: Prevents empty cards from cluttering the board, maintaining usability.

- **Drag-and-Drop Handling**:
  - `handleDragOver`: Prevents the default browser behavior (which would block dropping) by calling `event.preventDefault()`.
  - `handleDrop`: Parses the dragged card’s data from `dataTransfer`, extracts the `cardId` and `fromColumnId`, and calls the `moveCard` prop function to transfer the card.
  - **Why Two Events?**: `dragover` signals that the column is a drop target, while `drop` executes the move, adhering to the HTML5 Drag and Drop API’s event flow.

**Implementation Example**:
```typescript
<script>
  export let column;
  export let addCard;
  export let moveCard;

  let newTitle = '';

  function handleAddCard() {
    if (newTitle.trim()) {
      addCard(column.id, newTitle);
      newTitle = '';
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(event) {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    const { cardId, columnId: fromColumnId } = data;
    moveCard(fromColumnId, column.id, cardId);
  }
</script>

<div
  class="w-64 bg-gray-100 p-4 rounded-lg"
  on:dragover={handleDragOver}
  on:drop={handleDrop}
>
  <h2 class="text-lg font-bold mb-2">{column.name}</h2>
  {#each column.cards as card}
    <Card {card} columnId={column.id} />
  {/each}
  <input
    bind:value={newTitle}
    placeholder="New task title"
    class="w-full p-2 mb-2 border rounded"
  />
  <button
    on:click={handleAddCard}
    class="w-full bg-green-500 text-white p-2 rounded"
  >
    Add Card
  </button>
</div>
```

### Card Component

**Purpose**: Renders a single card that users can drag to other columns.

**Key Responsibilities**:
- Makes the card draggable using the HTML5 `draggable` attribute.
- Sets up the data to transfer when dragging begins.

**Core Logic**:
- **Drag Start**:
  - The `handleDragStart` function serializes the card’s `id` and its `columnId` into a JSON string, storing it in `dataTransfer` with the `text/plain` type.
  - This data is critical for the drop target to identify which card is being moved and from where.
  - **Why JSON?**: It’s a lightweight, structured format that allows multiple pieces of data (card ID and column ID) to be transferred reliably.

**Implementation Example**:
```typescript
<script>
  export let card;
  export let columnId;

  function handleDragStart(event) {
    const data = JSON.stringify({ cardId: card.id, columnId });
    event.dataTransfer.setData('text/plain', data);
  }
</script>

<div
  draggable="true"
  on:dragstart={handleDragStart}
  class="bg-white p-2 mb-2 rounded shadow cursor-move"
>
  {card.title}
</div>
```

---

## Drag-and-Drop Functionality

The drag-and-drop feature leverages the HTML5 Drag and Drop API to enable seamless card movement between columns.

- **Dragging a Card**:
  - The `Card` component sets the `draggable` attribute to `true`.
  - On `dragstart`, it packages the card’s `id` and `columnId` into `dataTransfer`, providing all necessary information for the drop target.

- **Dropping a Card**:
  - The `Column` component handles `dragover` to allow dropping and `drop` to process the move.
  - During `drop`, it retrieves and parses the `dataTransfer` data, then invokes `moveCard` to update the state.
  - **Why Both IDs?**: The `cardId` identifies the specific card, while the `fromColumnId` specifies its origin, ensuring the correct card is removed from the source and added to the target.

- **State Update**:
  - The `moveCard` function in `KanbanBoard` performs the transfer by filtering the card out of the source column and appending it to the target column.
  - Immutable operations ensure Svelte’s reactivity kicks in, re-rendering the UI to reflect the new card position.

**Logic Depth**:
- The API’s event-driven nature requires careful coordination: `dragstart` prepares the data, `dragover` enables the drop, and `drop` finalizes the action.
- By avoiding direct state mutations, the implementation remains predictable and compatible with Svelte’s reactive system.

---

## Interactivity

The Kanban board supports rich user interactions to mimic real-world Kanban functionality:

- **Adding Cards**:
  - Each column’s input and button allow users to create new tasks.
  - The `handleAddCard` function ensures only non-empty titles are added, calling `addCardToColumn` to update the state.
  - **Why Local State for Input?**: Binding `newTitle` to the input keeps the component self-contained, reducing complexity in the parent.

- **Moving Cards**:
  - Drag-and-drop moves cards between columns, with `moveCard` handling the logic.
  - The check for identical source and target columns prevents redundant updates, enhancing efficiency.

- **Adding Columns**:
  - A button in `KanbanBoard` triggers `addColumn`, appending a new column to the state.
  - This optional feature demonstrates scalability, allowing the board to grow as needed.

**Logic Depth**:
- Interactivity is driven by event handlers that update the reactive state, ensuring the UI stays in sync with user actions.
- The separation of concerns (e.g., input handling in `Column`, state updates in `KanbanBoard`) keeps the logic modular and testable.

---

## Styling Approach

Tailwind CSS provides utility classes for a consistent, responsive design:

- **KanbanBoard**: Uses `flex space-x-4 p-4` for a horizontal layout with column spacing.
- **Column**: Styled with `w-64 bg-gray-100 p-4 rounded-lg` for a fixed-width, padded, and rounded appearance.
- **Card**: Applies `bg-white p-2 mb-2 rounded shadow cursor-move` for a card-like look with a draggable cursor.
- **Inputs/Buttons**: Use classes like `border rounded` and `bg-green-500 text-white` for a polished UI.

**Logic Behind Styling**:
- Tailwind’s utility-first approach avoids custom CSS, speeding up development and ensuring consistency.
- The `cursor-move` class on cards provides a visual cue for draggability, enhancing UX without additional logic.

---

## Application Assembly

The main page integrates the `KanbanBoard` component into a simple layout:

**Implementation Example** (`src/routes/+page.svelte`):
```typescript
<script>
  import KanbanBoard from '$lib/KanbanBoard.svelte';
</script>

<main class="container mx-auto">
  <h1 class="text-2xl font-bold mb-4">Kanban Board</h1>
  <KanbanBoard />
</main>
```

**Logic**:
- The `KanbanBoard` component is the sole focus, with a title providing context.
- The `container mx-auto` class centers the content, aligning with common UI patterns.

---

## Summary

This Kanban board proof of concept demonstrates a robust frontend implementation with:
- **Reactive State**: Managed via Svelte 5’s `$state` for automatic UI updates.
- **Modular Components**: `KanbanBoard`, `Column`, and `Card` separate concerns effectively.
- **Drag-and-Drop**: Built on the HTML5 API for intuitive card movement.
- **Interactivity**: Supports card addition, movement, and column creation with clear logic.
- **Styling**: Leverages Tailwind CSS for a modern, maintainable design.

The logic prioritizes immutability, modularity, and reactivity, providing a scalable foundation for future enhancements like backend integration or additional features.