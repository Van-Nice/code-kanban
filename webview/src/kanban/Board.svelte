<script lang="ts">
  import ColumnComponent from './Column.svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { onMount, onDestroy } from 'svelte';
  import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext, log, error } from '../utils/vscodeMessaging';
  import type { Board, Column, Card } from '../types';
  import { Commands } from '../shared/commands';

  let { boardId } = $props<{
    boardId: string;
  }>();

  let columns = $state<Column[]>([]);
  let messageHandler: (message: any) => void;
  let webviewContext = $state<string>('');
  let isLoading = $state(true);
  let boardTitle = $state('');
  let boardUpdatedAt = $state<string | undefined>(undefined);
  
  // Card creation state
  let isCreatingCard = $state(false);
  let targetColumnId = $state('');
  let newCardTitle = $state('');
  let newCardDescription = $state('');
  let newCardAssignee = $state(''); 
  let newCardLabels = $state<string[]>([]);
  let newLabelInput = $state('');
  
  // Store a reference to the VSCode API
  let vsCodeApi: any;

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
    
    // Set up message listener with extra validation
    messageHandler = (message) => {
      log(`Board received raw message:`, message);

      // Perform validation on the message
      if (!message) {
        error("Received null or undefined message");
        return;
      }
      
      if (!message.command) {
        error("Received message without command property:", message);
        return;
      }

      // Check for card added messages specifically
      if (message && (message.command === Commands.CARD_ADDED || message.command === "cardAdded")) {
        log(`⭐ CARD_ADDED message received by Board component!`, message.data);
      }

      handleExtensionMessage(message);
    };
    
    log('Board component: Setting up message listener');
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

    // Request board data from extension
    log(`Board component: Requesting board data for boardId: ${boardId}`);
    requestBoardData();
    
    // Setting isLoading to false after a timeout to ensure UI is responsive
    setTimeout(() => {
      log('Board component: Setting isLoading to false after timeout');
      isLoading = false;
    }, 1000);
  });

  onDestroy(() => {
    // Clean up message listener
    if (messageHandler) {
      log('Board component: Cleaning up message listener on destroy');
      removeMessageListener(messageHandler);
    }
  });

  function handleExtensionMessage(message: any) {
    // The message might be an event or a direct message object
    // If it's an event (has data property), extract the data
    if (message && message.data && message.data.command) {
      message = message.data;
    }
    
    if (!message || !message.command) {
      log('Board received invalid message, ignoring:', message);
      return;
    }

    log(`Board received message: ${message.command}`);

    switch (message.command) {
      case Commands.BOARD_LOADED:
      case "boardLoaded":
        log('Processing BOARD_LOADED message:', message.data);
        if (message.data.success) {
          log('Board load success - updating columns with data');
          columns = message.data.columns?.map((col: any) => ({
            ...col,
            cards: col.cards || []
          })) || [];
          boardTitle = message.data.title || 'Untitled Board';
          log('Board data loaded successfully:', 
            { 
              columnCount: columns.length, 
              boardTitle 
            }
          );
          boardUpdatedAt = message.data.updatedAt;
          isLoading = false;
          log('Set isLoading to false after successful board load');
        }
        break;
      case Commands.CARD_ADDED:
      case "cardAdded":
        log('Processing CARD_ADDED message:', message.data);
        if (message.data.success && message.data.card) {
          const { card, columnId } = message.data;
          log('Adding new card to column:', columnId);
          log('Card details:', card);
          
          // Find the column that should receive this card
          const targetColumnIndex = columns.findIndex((col: Column) => col.id === columnId);
          if (targetColumnIndex >= 0) {
            log('Found matching column at index:', targetColumnIndex);
            
            // Create a new columns array with the updated column
            const updatedColumns = [...columns];
            
            // Create an updated column with the new card
            const targetColumn = updatedColumns[targetColumnIndex];
            const updatedColumn = {
              ...targetColumn,
              cards: [...targetColumn.cards, card]
            };
            
            // Replace the old column with the updated one
            updatedColumns[targetColumnIndex] = updatedColumn;
            
            // Update the columns array
            columns = updatedColumns;
            
            log(`Column ${columnId} updated with new card ${card.id}`);
            log(`Column now has ${updatedColumn.cards.length} cards`);
          } else {
            error('Cannot add card: column not found', { columnId });
          }
        } else if (!message.data.success) {
          error('Failed to add card:', message.data.error);
        }
        break;
      case Commands.BOARD_UPDATED:
        if (message.data.success && message.data.board) {
          boardTitle = message.data.board.title;
          boardUpdatedAt = message.data.board.updatedAt;
        }
        break;
      case Commands.COLUMN_UPDATED:
        if (message.data.success && message.data.column) {
          columns = columns.map((col: Column) => 
            col.id === message.data.column.id ? {
              ...col,
              ...message.data.column,
              cards: col.cards
            } : col
          );
          boardUpdatedAt = message.data.updatedAt;
        }
        break;
      case Commands.CARD_UPDATED:
        if (message.data.success) {
          const { card } = message.data;
          columns = columns.map(col => {
            if (col.id === card.columnId) {
              return {
                ...col,
                cards: col.cards.map(c => c.id === card.id ? card : c)
              };
            }
            return col;
          });
        }
        break;
      case Commands.CARD_DELETED:
        if (message.data.success) {
          const { cardId, columnId } = message.data;
          columns = columns.map(col => {
            if (col.id === columnId) {
              return {
                ...col,
                cards: col.cards.filter(c => c.id !== cardId)
              };
            }
            return col;
          });
        }
        break;
      case Commands.CARD_MOVED:
        if (message.data.success) {
          const { cardId, fromColumnId, toColumnId, position } = message.data;
          columns = columns.map(col => {
            if (col.id === fromColumnId) {
              return {
                ...col,
                cards: col.cards.filter(c => c.id !== cardId)
              };
            }
            if (col.id === toColumnId) {
              const card = columns.find(c => c.id === fromColumnId)?.cards.find(c => c.id === cardId);
              if (card) {
                const newCards = [...col.cards];
                newCards.splice(position, 0, { ...card, columnId: toColumnId });
                return {
                  ...col,
                  cards: newCards
                };
              }
            }
            return col;
          });
        }
        break;
      case Commands.COLUMN_ADDED:
        log('Processing COLUMN_ADDED message:', message.data);
        if (message.data.success && message.data.column) {
          const { column } = message.data;
          log('Adding new column to board:', column);
          
          // Check if column already exists to avoid duplicates
          const existingColumn = columns.find((col: Column) => col.id === column.id);
          if (existingColumn) {
            log('Column already exists, skipping:', column.id);
          } else {
            // Ensure the column has a cards array
            const newColumn = {
              ...column,
              cards: column.cards || []
            };
            log('Adding new column to columns array:', newColumn);
            columns = [...columns, newColumn];
            log(`Columns array updated. Now has ${columns.length} columns`);
          }
        } else if (!message.data.success) {
          error('Failed to add column:', message.data.error);
        }
        break;
      case Commands.COLUMN_DELETED:
        if (message.data.success) {
          const { columnId } = message.data;
          columns = columns.filter(col => col.id !== columnId);
        }
        break;
      default:
        break;
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
      labels: [],
      assignee: '',
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
        labels: newCard.labels,
        assignee: String(newCard.assignee || '')
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

  function requestBoardData() {
    if (!boardId) {
      error('Cannot request board data: boardId is missing');
      return;
    }

    sendMessage({
      command: Commands.GET_BOARD,
      data: { boardId }
    });
  }

  function handleCardUpdated(card: Card) {
    sendMessage({
      command: Commands.UPDATE_CARD,
      data: { card, boardId }
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

  function handleAddCard(columnId: string) {
    log('🎯 handleAddCard called for column:', columnId);
    log('Opening new card form for column', { columnId });
    
    targetColumnId = columnId;
    log('🎯 Set targetColumnId to:', targetColumnId);
    
    newCardTitle = '';
    newCardDescription = '';
    newCardAssignee = '';
    newCardLabels = [];
    
    isCreatingCard = true;
    log('🎯 Card creation form should now be visible, isCreatingCard =', isCreatingCard);
  }
  
  function createCard() {
    log('📝 createCard function called');
    
    if (!newCardTitle.trim()) {
      log('Cannot create card: title is empty');
      return;
    }
    
    log('Creating new card with values:', {
      title: newCardTitle,
      description: newCardDescription,
      assignee: newCardAssignee,
      labels: newCardLabels,
      columnId: targetColumnId,
      boardId
    });
    
    log('Creating new card for column', { columnId: targetColumnId });
    
    isCreatingCard = false;

    // Use the standard message pattern, just like addColumn
    sendMessage({
      command: Commands.ADD_CARD,
      data: {
        boardId,
        columnId: targetColumnId,
        title: newCardTitle,
        description: String(newCardDescription || ''),
        labels: [...newCardLabels],
        assignee: String(newCardAssignee || '')
      }
    });
    
    log('Card creation message sent with all fields');
  }
  
  function cancelCardCreation() {
    isCreatingCard = false;
  }

  function addLabel() {
    if (!newLabelInput.trim()) return;
    if (newCardLabels.includes(newLabelInput.trim())) return;
    
    newCardLabels = [...newCardLabels, newLabelInput.trim()];
    newLabelInput = '';
  }
  
  function removeLabel(label: string) {
    newCardLabels = newCardLabels.filter(l => l !== label);
  }
</script>

<!-- Root container with adaptive styling based on context -->
<!-- The h-full class makes the container take full height of its parent -->
<!-- sidebar-context class is conditionally added to apply different styles when displayed in the sidebar -->
<div class="h-full {webviewContext === 'sidebar' ? 'sidebar-context' : ''}">
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
              onCardMoved={handleCardMove}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
              onAddCard={handleAddCard}
              onDeleteColumn={deleteColumn}
              onUpdateColumn={(columnData) => handleUpdateColumn(columnData)}
            />
          </div>
        {/each}
      </div>
    {:else}
      <!-- Editor layout: columns arranged horizontally (side by side) -->
      <!-- This is the standard Kanban layout for wider views -->
      <div class="flex gap-4 min-h-screen overflow-x-auto pb-4">
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
              onCardMoved={handleCardMove}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
              onAddCard={handleAddCard}
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
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <!-- Modal dialog box -->
      <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-sm p-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <!-- Modal header with title and close button -->
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-sm font-medium text-[var(--vscode-foreground)]">Create New Card</h2>
          <!-- Close button (X) -->
          <button
            onclick={cancelCardCreation}
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
          
          <!-- Card assignee input field -->
          <div>
            <label for="card-assignee" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Assignee</label>
            <input
              type="text"
              id="card-assignee"
              bind:value={newCardAssignee}
              class="w-full px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              placeholder="Enter assignee name"
            />
          </div>
          
          <!-- Labels section with existing labels display and new label input -->
          <div>
            <label for="new-label" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Labels</label>
            <!-- Display existing labels as badges with remove buttons -->
            <div class="flex flex-wrap gap-1 mb-2">
              {#each newCardLabels as label}
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                  {label}
                  <!-- Remove label button (X) -->
                  <button
                    type="button"
                    onclick={() => removeLabel(label)}
                    class="ml-1 text-[var(--vscode-badge-foreground)] hover:text-[var(--vscode-errorForeground)]"
                    aria-label="Remove label {label}"
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
            <!-- Input group for adding new labels -->
            <div class="flex gap-1">
              <!-- New label input with Enter key support -->
              <input
                type="text"
                id="new-label"
                bind:value={newLabelInput}
                class="flex-1 px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-l-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
                placeholder="Add label..."
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission
                    addLabel(); // Call addLabel function instead
                  }
                }}
              />
              <!-- Add label button -->
              <button
                type="button"
                onclick={addLabel}
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
              onclick={cancelCardCreation}
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