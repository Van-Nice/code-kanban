<script lang="ts">
  import ColumnComponent from './Column.svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { onMount, onDestroy } from 'svelte';
  import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext, log, error } from '../utils/vscodeMessaging';
  import type { Board, Column, Card } from '../types';
  import { Commands } from '../shared/commands';
  import type { Board as SharedBoard } from '../shared/types';

  let { board } = $props<{
    board: SharedBoard;
  }>();

  let columns = $state<Column[]>(board.columns || []);
  let boardId = $state<string>(board.id);
  let messageHandler: (message: any) => void;
  let webviewContext = $state<string>('');
  let isLoading = $state(false);
  let boardTitle = $state<string>(board.title || 'Untitled Board');
  let boardUpdatedAt = $state<string | undefined>(board.updatedAt);
  
  // Card creation state
  let isCreatingCard = $state(false);
  let targetColumnId = $state('');
  let newCardTitle = $state('');
  let newCardDescription = $state('');
  let newCardTags = $state<string[]>([]);
  let newTagInput = $state('');
  
  // Store a reference to the VSCode API
  let vsCodeApi: any;

  // Reference to the horizontal scroll container in editor mode
  let editorScrollContainer = $state<HTMLElement | null>(null);

  // Drag and Drop state
  let isDraggingOver = $state(false);

  // Auto-scroll state
  let scrollIntervalId: number | null = null;
  let scrollDirection: 'up' | 'down' | 'left' | 'right' | null = null;
  const scrollSpeed = 15; // Pixels per interval
  const scrollInterval = 50; // Milliseconds

  onMount(() => {
    // Initialize VSCode API and store the reference
    try {
      vsCodeApi = initializeVSCodeApi();
      console.log("🔍 Board: VSCode API initialized:", !!vsCodeApi);
      log("🔍 Board: VSCode API initialized successfully: " + (!!vsCodeApi));
      
      // Verify the API has postMessage function
      if (vsCodeApi && typeof vsCodeApi.postMessage === 'function') {
        log("🔍 Board: VSCode API postMessage function is available");
      } else {
        error("🔍 Board: VSCode API postMessage function is NOT available!");
      }
    } catch (err) {
      console.error("🔍 Board: Error initializing VSCode API:", err);
      log("🔍 Board: Error initializing VSCode API: " + String(err));
    }
    
    // Get the webview context
    webviewContext = getWebviewContext();
    
    log(`Board mounted with boardId: ${boardId}, webviewContext: ${webviewContext}`);
    
    // Set up message listener
    messageHandler = (message) => {
      handleExtensionMessage(message);
    };
    setupMessageListener(messageHandler);
    
    // Send a test message to verify communication channel
    try {
      log('Sending test message to extension');
      sendMessage({
        command: 'ping',
        data: { timestamp: new Date().toISOString() }
      });
      log('Test message sent successfully');
    } catch (err) {
      error('Failed to send test message:', err);
    }
  });

  onDestroy(() => {
    // Clean up message listener when component is destroyed
    if (messageHandler) {
      log('Board: cleaning up message listener');
      removeMessageListener(messageHandler);
    }
  });

  function handleExtensionMessage(message: any) {
    log('Board received message:', message);
    switch (message.command) {
      case Commands.CARD_ADDED:
        log('Board: Received CARD_ADDED', message.data);
        const { card: newCard, columnId: targetCardColumnId } = message.data;
        if (!newCard || !targetCardColumnId) {
          error('Board: Invalid CARD_ADDED data', message.data);
          return;
        }
        const cardColumnIndex = columns.findIndex(col => col.id === targetCardColumnId);
        if (cardColumnIndex !== -1) {
          // Update the columns array immutably to ensure reactivity
          columns = columns.map((col, index) => {
            if (index === cardColumnIndex) {
              // Defensive check: Only add the card if it doesn't already exist in the local state
              const cardExists = (col.cards || []).some((card: Card) => card.id === newCard.id);
              if (cardExists) {
                log('Board: Card already exists in local state, skipping add.', { cardId: newCard.id, columnId: col.id });
                return col; // Return column unchanged
              }
              // Create a new column object with the new card added to the beginning of its cards array
              return { 
                ...col, 
                cards: [newCard, ...(col.cards || [])] 
              };
            }
            return col;
          });
          log('Board: Card added to local state', { cardId: newCard.id, columnId: targetCardColumnId });
        } else {
          error('Board: Column not found for CARD_ADDED', { columnId: targetCardColumnId });
        }
        break;

      case Commands.COLUMN_ADDED:
        log('Board: Received COLUMN_ADDED', message.data);
        const { column: newColumn } = message.data;
        if (!newColumn) {
          error('Board: Invalid COLUMN_ADDED data', message.data);
          return;
        }
        // Add the new column, ensuring cards array exists
        columns = [...columns, { ...newColumn, cards: newColumn.cards || [] }];
        log('Board: Column added to local state', { columnId: newColumn.id });
        break;

      case Commands.BOARD_LOADED: // Assuming the extension might send the full board on updates
        log('Board: Received BOARD_LOADED', message.data);
        // Replace local state with the new board data
        if (message.data.board && message.data.board.id === boardId) {
          boardTitle = message.data.board.title;
          // Ensure columns and cards within columns exist
          columns = (message.data.board.columns || []).map((col: Column) => ({ ...col, cards: col.cards || [] }));
          boardUpdatedAt = message.data.board.updatedAt;
          log('Board: Local state updated from BOARD_LOADED');
        } else {
          log('Board: Received BOARD_LOADED for a different board or invalid data', { expected: boardId, received: message.data.board?.id });
        }
        break;
        
      case Commands.COLUMN_DELETED:
        log('Board: Received COLUMN_DELETED', message.data);
        const { columnId: deletedColumnId } = message.data;
        if (!deletedColumnId) {
          error('Board: Invalid COLUMN_DELETED data', message.data);
          return;
        }
        columns = columns.filter(col => col.id !== deletedColumnId);
        log('Board: Column removed from local state', { columnId: deletedColumnId });
        break;

      case Commands.COLUMN_UPDATED:
        log('Board: Received COLUMN_UPDATED', message.data);
        // Correctly destructure from message.data.column
        const { column } = message.data;
        if (!column || !column.id || column.title === undefined) {
          error('Board: Invalid COLUMN_UPDATED data', message.data);
          return;
        }
        const { id: updatedColumnId, title: updatedTitle } = column;
        const updatedColumnIndex = columns.findIndex(col => col.id === updatedColumnId);
        if (updatedColumnIndex !== -1) {
          // Create a new object for the updated column to ensure reactivity
          const updatedColumnData = { ...columns[updatedColumnIndex], title: updatedTitle };
          // Update the columns array immutably
          columns = columns.map((col, index) => 
            index === updatedColumnIndex ? updatedColumnData : col
          );
          log('Board: Column title updated in local state', { columnId: updatedColumnId, newTitle: updatedTitle });
        } else {
          error('Board: Column not found for COLUMN_UPDATED', { columnId: updatedColumnId });
        }
        break;

      case Commands.CARD_UPDATED:
        log('Board: Received CARD_UPDATED', message.data);
        const { card: updatedCardData, columnId: targetUpdateColumnId } = message.data;
        if (!updatedCardData || !targetUpdateColumnId) {
          error('Board: Invalid CARD_UPDATED data', message.data);
          return;
        }
        
        columns = columns.map(col => {
          if (col.id === targetUpdateColumnId) {
            // Found the correct column, now update the specific card
            const updatedCards = (col.cards || []).map((card: Card) => 
              card.id === updatedCardData.id ? updatedCardData : card
            );
            return { ...col, cards: updatedCards };
          }
          return col; // Return other columns unchanged
        });
        log('Board: Card updated in local state', { cardId: updatedCardData.id, columnId: targetUpdateColumnId });
        break;

      case Commands.CARD_DELETED:
        log('Board: Received CARD_DELETED', message.data);
        const { cardId: deletedCardId, columnId: targetDeleteColumnId } = message.data;
        if (!deletedCardId || !targetDeleteColumnId) {
          error('Board: Invalid CARD_DELETED data', message.data);
          return;
        }

        columns = columns.map(col => {
          if (col.id === targetDeleteColumnId) {
            // Found the correct column, now filter out the deleted card
            const updatedCards = (col.cards || []).filter((card: Card) => card.id !== deletedCardId);
            return { ...col, cards: updatedCards };
          }
          return col; // Return other columns unchanged
        });
        log('Board: Card deleted from local state', { cardId: deletedCardId, columnId: targetDeleteColumnId });
        break;

      case Commands.CARD_MOVED:
        log('Board: Received CARD_MOVED', message.data);
        const { newColumns } = message.data;
        if (!newColumns || !Array.isArray(newColumns)) {
          error('Board: Invalid CARD_MOVED data - missing or invalid newColumns', message.data);
          return;
        }
        // Replace local columns state with the updated columns from the extension
        // Ensure nested cards arrays exist
        columns = newColumns.map((col: Column) => ({ ...col, cards: col.cards || [] }));
        log('Board: Columns state updated after card move.');
        break;

      default:
        log('Board: Received unknown command or command not handled yet:', message.command);
    }
  }

  function getColumnCards(columnId: string): Card[] {
    const column = columns.find(col => col.id === columnId);
    return column ? column.cards : [];
  }

  function addCard(columnId: string) {
    const newCard: Card = {
      id: uuidv4(),
      title: 'New Card',
      description: '',
      tags: [],
      columnId,
      boardId,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    log('Sending addCard message to extension with data:', { boardId, columnId, title: newCard.title });
    sendMessage({
      command: Commands.ADD_CARD,
      data: { 
        boardId,
        columnId,
        title: newCard.title,
        description: newCard.description,
        tags: newCard.tags,
      }
    });
    log('addCard message sent to extension');
  }

  function handleCardMove(data: { cardId: string, fromColumnId: string, toColumnId: string, position?: number }) {
    const { cardId, fromColumnId, toColumnId, position } = data;
    sendMessage({
      command: Commands.MOVE_CARD,
      data: { cardId, fromColumnId, toColumnId, position, boardId }
    });
  }
  
  function addColumn() {
    const newColumn: Column = {
      id: uuidv4(),
      title: 'New Column',
      cards: [],
      order: columns.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    log('Adding new column');
    
    // Use the standard sendMessage approach for consistency
    sendMessage({
      command: Commands.ADD_COLUMN,
      data: { 
        boardId,
        columnId: newColumn.id,
        title: newColumn.title
      }
    });
    
    log('Column creation message sent to extension');
  }

  function updateColumn(column: Column) {
    log('Sending updateColumn message to extension with data:', { columnId: column.id, title: column.title, boardId });
    sendMessage({
      command: Commands.UPDATE_COLUMN,
      data: { 
        boardId,
        columnId: column.id,
        title: column.title
      }
    });
    log('updateColumn message sent to extension');
  }

  function handleUpdateColumn(column: Column) {
    if (!column || !column.id) {
      error('Cannot update column: invalid column data', null);
      return;
    }

    const existingColumn = columns.find(col => col.id === column.id);
    if (!existingColumn) {
      error('Cannot update column: column not found', null);
      return;
    }

    const updatedColumn = {
      ...column,
      cards: existingColumn.cards,
      order: existingColumn.order
    };

    updateColumn(updatedColumn);
  }

  function deleteColumn(columnId: string) {
    log('deleteColumn function called with columnId:', columnId);
    
    // Add this log to check the length
    log(`Checking columns.length before delete check: ${columns.length}`);

    if (columns.length <= 1) {
      error('Cannot delete the last column in a board', null);
      log('Cannot delete column: only one column left in board');
      return;
    }
    
    log('Sending deleteColumn message to extension with data:', { columnId, boardId });
    sendMessage({
      command: Commands.DELETE_COLUMN,
      data: { columnId, boardId }
    });
    log('deleteColumn message sent to extension');
  }

  function handleCardUpdated(card: Card) {
    // Ensure tags are a plain array before sending
    const plainTags = Array.isArray(card.tags) ? [...card.tags] : []; 
    
    log('Board: Sending UPDATE_CARD message', { cardId: card.id, title: card.title, description: card.description, tags: plainTags });
    
    sendMessage({
      command: Commands.UPDATE_CARD,
      data: {
        boardId: boardId, // Make sure boardId is passed correctly
        columnId: card.columnId, // Pass columnId
        cardId: card.id, // Pass cardId
        title: card.title,
        description: card.description,
        tags: plainTags, // Use plain array
        order: card.order // Pass order
        // createdAt is not needed for update message
        // updatedAt will be set by the backend
      }
    });
  }

  function handleCardDeleted(cardId: string) {
    const column = columns.find(col => col.cards.some(c => c.id === cardId));
    if (column) {
      sendMessage({
        command: Commands.DELETE_CARD,
        data: { cardId, columnId: column.id, boardId }
      });
    }
  }

  function startCreatingCard(columnId: string) {
    log('Starting card creation for column:', columnId);
    targetColumnId = columnId;
    isCreatingCard = true;
    newCardTitle = '';
    newCardDescription = '';
    newCardTags = [];
    newTagInput = '';
  }

  function cancelCreateCard() {
    isCreatingCard = false;
  }

  function addTag() {
    if (!newTagInput.trim()) return;
    if (newCardTags.includes(newTagInput.trim())) {
      newTagInput = '';
      return;
    }
    newCardTags = [...newCardTags, newTagInput.trim()];
    newTagInput = '';
  }

  function removeTag(tagToRemove: string) {
    newCardTags = newCardTags.filter(tag => tag !== tagToRemove);
  }

  function createCard() {
    if (!newCardTitle.trim()) {
      error('Cannot create card: title is empty');
      return;
    }
    log('Creating card with title:', newCardTitle);

    const newCardId = uuidv4();
    // Convert tags proxy to plain array for postMessage compatibility
    const plainTags = [...newCardTags];

    // Send message to extension to create card
    sendMessage({
      command: Commands.ADD_CARD,
      data: {
        boardId: boardId,
        columnId: targetColumnId,
        cardId: newCardId,
        title: newCardTitle.trim(), // Trim title here as well
        description: newCardDescription.trim(), // Trim description
        tags: plainTags // Use the plain array
      }
    });

    // Reset form and close
    isCreatingCard = false;
    newCardTitle = '';
    newCardDescription = '';
    newCardTags = [];
    newTagInput = '';
    log('Create card message sent, form reset.');
  }

  /**
   * Sends a message to the extension to persist the new collapsed state of a column.
   */
  function handleColumnToggle(columnId: string, collapsed: boolean) {
    log('Column toggle requested', { columnId, collapsed, boardId });
    // Send message to extension to persist state
    sendMessage({
      command: Commands.SET_COLUMN_COLLAPSED_STATE,
      data: { boardId, columnId, collapsed }
    });
  }

  /**
   * Starts the auto-scroll interval in the specified direction.
   */
  function startScrolling(direction: 'up' | 'down' | 'left' | 'right') {
    if (scrollIntervalId !== null && scrollDirection === direction) {
      return; // Already scrolling in this direction
    }
    
    stopScrolling(); // Clear any existing interval first

    scrollDirection = direction;

    scrollIntervalId = setInterval(() => {
      if (webviewContext === 'sidebar') {
        if (scrollDirection === 'up') {
          window.scrollBy(0, -scrollSpeed);
        } else if (scrollDirection === 'down') {
          window.scrollBy(0, scrollSpeed);
        }
      } else if (editorScrollContainer) {
        if (scrollDirection === 'left') {
          editorScrollContainer.scrollBy(-scrollSpeed, 0);
        } else if (scrollDirection === 'right') {
          editorScrollContainer.scrollBy(scrollSpeed, 0);
        }
      }
    }, scrollInterval);
  }

  /**
   * Stops the auto-scroll interval.
   */
  function stopScrolling() {
    if (scrollIntervalId !== null) {
      clearInterval(scrollIntervalId);
      scrollIntervalId = null;
    }
    scrollDirection = null;
  }

  /**
   * Handles drag over events on the main scroll containers to implement auto-scroll.
   */
  function handleBoardDragOver(event: DragEvent) {
    event.preventDefault(); // Necessary to allow dropping

    const target = event.currentTarget as HTMLElement;
    const clientX = event.clientX;
    const clientY = event.clientY;
    const edgeThreshold = 50; // Pixels from the edge to trigger scroll

    if (webviewContext === 'sidebar') {
      // Sidebar Mode (Vertical Scroll - check viewport edges)
      const viewportHeight = window.innerHeight;
      if (clientY < edgeThreshold) {
        log('Near top edge (sidebar)');
        startScrolling('up');
      } else if (clientY > viewportHeight - edgeThreshold) {
        log('Near bottom edge (sidebar)');
        startScrolling('down');
      } else {
        stopScrolling();
      }
    } else if (editorScrollContainer) {
      // Editor Mode (Horizontal Scroll - check container edges)
      const rect = editorScrollContainer.getBoundingClientRect();
      if (clientX < rect.left + edgeThreshold) {
        log('Near left edge (editor)');
        startScrolling('left');
      } else if (clientX > rect.right - edgeThreshold) {
        log('Near right edge (editor)');
        startScrolling('right');
      } else {
        stopScrolling();
      }
    } else {
        stopScrolling(); // Stop if context changes or container is missing
    }
  }

  function handleDragEnd(event: DragEvent, targetColumnId: string) {
    log(`handleDragEnd called for column: ${targetColumnId}`);
    // Reset drop zone styling
    isDraggingOver = false;
    
    if (scrollIntervalId) {
      clearInterval(scrollIntervalId);
      scrollIntervalId = null;
    }

    if (!event.dataTransfer) {
      log('handleDragEnd: No dataTransfer object found');
      return;
    }
    
    const cardDataString = event.dataTransfer.getData('text/plain');
    if (!cardDataString) {
      log('handleDragEnd: No card data found in dataTransfer');
      return;
    }
    
    try {
      const { cardId, fromColumnId } = JSON.parse(cardDataString);
      log('handleDragEnd: Parsed card data:', { cardId, fromColumnId });
      
      // Don't proceed if the card was dropped back into the same column
      if (fromColumnId === targetColumnId) {
        log('handleDragEnd: Card dropped into the same column, no action needed.');
        return;
      }
      
      // Determine the target position based on where it was dropped (e.g., index of card it was dropped onto)
      // For now, we'll just add it to the end (index 0 for beginning)
      const position = getColumnCards(targetColumnId).length; // Add to end

      // Send moveCard message to extension
      sendMessage({
        command: Commands.MOVE_CARD,
        data: { 
          boardId: boardId,
          cardId: cardId, 
          fromColumnId: fromColumnId, 
          toColumnId: targetColumnId,
          position: position // Position within the target column
        }
      });
      log('handleDragEnd: MOVE_CARD message sent to extension');

    } catch (e) {
      error('handleDragEnd: Failed to parse card data or send message', e);
    }
  }

  function handleAddColumn() {
    log('handleAddColumn function called');
    // Generate a unique ID for the new column
    // ... existing code ...
  }
</script>

<!-- Root container with adaptive styling based on context -->
<!-- The h-full class makes the container take full height of its parent -->
<!-- sidebar-context class is conditionally added to apply different styles when displayed in the sidebar -->
<div
  class="h-full {webviewContext === 'sidebar' ? 'sidebar-context' : ''}"
  ondragover={handleBoardDragOver}
  ondragleave={stopScrolling}
  ondrop={stopScrolling}
  role="group"
>
  {#if isLoading}
    <!-- Loading state: displays a centered spinner while board data is being fetched -->
    <div class="flex items-center justify-center h-full">
      <div class="flex flex-col items-center gap-2">
        <!-- Custom loading spinner using border trick and VS Code's progress bar color -->
        <div class="w-6 h-6 border-2 border-t-[var(--vscode-progressBar-background)] border-r-[var(--vscode-progressBar-background)] border-b-[var(--vscode-progressBar-background)] border-l-transparent rounded-full animate-spin"></div>
        <!-- Loading text with VS Code's description text color -->
        <span class="text-sm text-[var(--vscode-descriptionForeground)]">Loading board...</span>
      </div>
    </div>
  {:else}
    <!-- Board header: contains board title and "Add Column" button -->
    <div class="mb-4 flex justify-between items-center">
      <!-- Board title using VS Code's standard foreground color -->
      <h2 class="text-lg font-medium text-[var(--vscode-foreground)]">{boardTitle}</h2>
      <!-- "Add Column" button styled with VS Code's button colors -->
      <button
        onclick={addColumn}
        class="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] flex items-center gap-1"
      >
        <!-- Plus icon inside a square (using SVG) -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        Add Column
      </button>
    </div>
    
    {#if webviewContext === 'sidebar'}
      <!-- Sidebar layout: columns arranged vertically (stacked) -->
      <!-- This layout is optimized for the narrower width of VS Code's sidebar -->
      <div class="flex flex-col gap-4 min-h-screen">
        <!-- Loop through each column and render it vertically -->
        {#each columns as column (column.id)}
          <!-- Each column takes full width in sidebar mode -->
          <div class="flex-shrink-0 w-full">
            <!-- Render the Column component with all required props -->
            <!-- Pass callback functions for various card and column operations -->
            <ColumnComponent
              id={column.id}
              title={column.title}
              cards={column.cards}
              boardId={boardId}
              initialCollapsed={column.collapsed ?? false}
              onToggleCollapse={(newState) => handleColumnToggle(column.id, newState)}
              onCardMoved={handleCardMove}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
              onAddCard={startCreatingCard}
              onDeleteColumn={deleteColumn}
              onUpdateColumn={(columnData) => handleUpdateColumn(columnData)}
            />
          </div>
        {/each}
      </div>
    {:else}
      <!-- Editor layout: columns arranged horizontally (side by side) -->
      <!-- This is the standard Kanban layout for wider views -->
      <div
        bind:this={editorScrollContainer}
        class="flex gap-4 min-h-screen overflow-x-auto pb-4"
        ondragover={handleBoardDragOver}
        ondragleave={() => { /* TODO: Stop scrolling if active */ }}
        ondrop={() => { /* TODO: Stop scrolling if active */ }}
        role="group"
      >
        <!-- Loop through each column and render it horizontally -->
        {#each columns as column (column.id)}
          <!-- Each column has fixed width (w-72 = 18rem) and doesn't shrink -->
          <div class="flex-shrink-0 w-72">
            <!-- Render the Column component with all required props -->
            <ColumnComponent
              id={column.id}
              title={column.title}
              cards={column.cards}
              boardId={boardId}
              initialCollapsed={column.collapsed ?? false}
              onToggleCollapse={(newState) => handleColumnToggle(column.id, newState)}
              onCardMoved={handleCardMove}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
              onAddCard={startCreatingCard}
              onDeleteColumn={deleteColumn}
              onUpdateColumn={(columnData) => handleUpdateColumn(columnData)}
            />
          </div>
        {/each}
        
        <!-- Add column placeholder - displayed at the end of the columns -->
        <!-- Provides a visual cue for adding a new column with dashed border -->
        <div class="flex-shrink-0 w-72 border border-dashed border-[var(--vscode-panel-border)] rounded-sm h-full flex items-center justify-center">
          <button
            onclick={addColumn}
            class="flex flex-col items-center justify-center p-4 w-full h-full text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-colors rounded-sm"
          >
            <!-- Plus icon (SVG) -->
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span class="mt-2 text-sm">Add Column</span>
          </button>
        </div>
      </div>
    {/if}
    
    <!-- Empty state - displayed when there are no columns -->
    <!-- Provides a user-friendly message and call-to-action -->
    {#if columns.length === 0}
      <div class="flex flex-col items-center justify-center h-64 border border-dashed border-[var(--vscode-panel-border)] rounded-sm p-6">
        <!-- Plus icon in a square (SVG) -->
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--vscode-descriptionForeground)]">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <!-- Empty state message -->
        <p class="mt-4 text-[var(--vscode-descriptionForeground)] text-sm">No columns found. Add a column to get started.</p>
        <!-- "Add Column" button -->
        <button
          onclick={addColumn}
          class="mt-4 px-3 py-1.5 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        >
          Add Column
        </button>
      </div>
    {/if}
  {/if}

  <!-- Card Creation Modal - displayed when isCreatingCard is true -->
  <!-- Implemented as a fixed overlay covering the entire viewport -->
  {#if isCreatingCard}
    <div class="fixed inset-0 bg-opacity-30 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <!-- Modal dialog box -->
      <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-sm p-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <!-- Modal header with title and close button -->
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-sm font-medium text-[var(--vscode-foreground)]">Create New Card</h2>
          <!-- Close button (X) -->
          <button
            onclick={cancelCreateCard}
            class="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
            aria-label="Close"
          >
            <!-- X icon (SVG) -->
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <!-- Card creation form -->
        <!-- Prevents default form submission and calls createCard function instead -->
        <form
          onsubmit={(e: Event) => {
            e.preventDefault();
            createCard();
          }}
          class="space-y-3"
        >
          <!-- Card title input field (required) -->
          <div>
            <label for="card-title" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Title *</label>
            <!-- svelte-ignore a11y_autofocus - ignores accessibility warning about autofocus -->
            <input
              type="text"
              id="card-title"
              bind:value={newCardTitle}
              class="w-full px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              placeholder="Enter card title"
              autofocus
            />
          </div>
          
          <!-- Card description textarea -->
          <div>
            <label for="card-description" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Description</label>
            <textarea
              id="card-description"
              bind:value={newCardDescription}
              class="w-full px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              rows="3"
              placeholder="Enter card description"
            ></textarea>
          </div>
          
          <!-- Tags section with existing tags display and new tag input -->
          <div>
            <label for="new-tag" class="block text-xs text-[var(--vscode-foreground)] mb-1">Tags</label>
            <!-- Display existing tags as badges with remove buttons -->
            <div class="flex flex-wrap gap-1 mb-2">
              {#each newCardTags as tag}
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                  {tag}
                  <!-- Remove tag button (X) -->
                  <button
                    type="button"
                    onclick={() => removeTag(tag)}
                    class="ml-1 text-[var(--vscode-badge-foreground)] hover:text-[var(--vscode-errorForeground)]"
                    aria-label="Remove tag {tag}"
                  >
                    <!-- X icon (SVG) -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </span>
              {/each}
            </div>
            <!-- Input group for adding new tags -->
            <div class="flex gap-1">
              <!-- New tag input with Enter key support -->
              <input
                type="text"
                id="new-tag"
                bind:value={newTagInput}
                class="flex-1 px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-l-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
                placeholder="Add tag..."
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission
                    addTag(); // Call addTag function instead
                  }
                }}
              />
              <!-- Add tag button -->
              <button
                type="button"
                onclick={addTag}
                class="px-2 py-1 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border border-[var(--vscode-button-secondaryBorder)] rounded-r-sm hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              >
                Add
              </button>
            </div>
          </div>
          
          <!-- Form action buttons (Cancel and Create) -->
          <div class="flex justify-end gap-2 pt-2">
            <!-- Cancel button - styled as secondary button -->
            <button
              type="button"
              onclick={cancelCreateCard}
              class="px-2 py-1 text-[var(--vscode-foreground)] border border-[var(--vscode-button-secondaryBorder)] bg-[var(--vscode-button-secondaryBackground)] rounded-sm hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
            >
              Cancel
            </button>
            <!-- Create button (submit) - styled as primary button -->
            <button
              type="submit"
              class="px-2 py-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Custom scrollbar styling to match VSCode */
  :global(.cards-list::-webkit-scrollbar) {
    width: 10px;
  }
  
  :global(.cards-list::-webkit-scrollbar-track) {
    background: var(--vscode-scrollbarSlider-background);
    border-radius: 3px;
  }
  
  :global(.cards-list::-webkit-scrollbar-thumb) {
    background: var(--vscode-scrollbarSlider-hoverBackground);
    border-radius: 3px;
  }
  
  :global(.cards-list::-webkit-scrollbar-thumb:hover) {
    background: var(--vscode-scrollbarSlider-activeBackground);
  }
</style>