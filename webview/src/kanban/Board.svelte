<script lang="ts">
  import Column from './Column.svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { onMount, onDestroy } from 'svelte';
  import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext, log, error } from '../utils/vscodeMessaging';
  import type { Card, ColumnData, BoardSnapshot } from './types';

  const { boardId } = $props<{
    boardId: string;
  }>();

  let columns = $state<ColumnData[]>([]);
  let messageHandler: (message: any) => void;
  let webviewContext = $state<string>('');
  let isLoading = $state(true);
  let boardTitle = $state('');
  let boardSnapshots = $state<BoardSnapshot[]>([]);
  let maxSnapshots = 5; // Keep the last 5 snapshots
  
  // Card creation state
  let isCreatingCard = $state(false);
  let targetColumnId = $state('');
  let newCardTitle = $state('');
  let newCardDescription = $state('');
  let newCardAssignee = $state(''); 
  let newCardLabels = $state<string[]>([]);
  let newLabelInput = $state('');

  // Function to create a snapshot of the current board state
  function createBoardSnapshot(operation: string) {
    // Create a deep copy of columns to prevent reference issues
    const snapshot: BoardSnapshot = {
      columns: JSON.parse(JSON.stringify(columns)), 
      timestamp: Date.now(),
      operation
    };
    
    // Add the snapshot and maintain max size
    boardSnapshots = [snapshot, ...boardSnapshots].slice(0, maxSnapshots);
    log(`Created board snapshot for operation: ${operation}`);
  }

  // Function to restore the board state from the latest snapshot
  function restoreFromSnapshot(operation: string) {
    if (boardSnapshots.length > 0) {
      log(`Restoring board state from snapshot due to failed ${operation}`);
      columns = boardSnapshots[0].columns;
      // Remove the used snapshot
      boardSnapshots = boardSnapshots.slice(1);
    } else {
      error(`No snapshots available to recover from failed ${operation}`, null);
      // Refresh the board from the server as a last resort
      requestBoardData(0);
    }
  }

  onMount(() => {
    // Initialize VSCode API
    initializeVSCodeApi();
    
    // Get the webview context
    webviewContext = getWebviewContext();
    
    log(`Board mounted with boardId: ${boardId}, webviewContext: ${webviewContext}`);
    
    // Set up message listener
    messageHandler = (message) => {
      handleExtensionMessage(message);
    };
    setupMessageListener(messageHandler);

    // Request board data from extension with retries
    requestBoardData();
    
    // Set up global console error handler to catch any issues
    const originalConsoleError = console.error;
    console.error = function(...args) {
      originalConsoleError.apply(console, args);
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Svelte')) {
        error('Board component error detected', args);
      }
    };
  });

  onDestroy(() => {
    // Clean up message listener
    if (messageHandler) {
      removeMessageListener(messageHandler);
    }
  });

  function handleExtensionMessage(message: any) {
    log('Board received message', message);
    
    switch (message.command) {
      case 'boardLoaded':
        if (message.data.success) {
          log('Board loaded', message.data);
          columns = message.data.columns;
          
          // Log the loaded columns to verify card states
          log('Loaded columns with cards', columns.map(col => ({
            id: col.id,
            title: col.title,
            cardCount: col.cards.length,
            cards: col.cards.map(card => ({ 
              id: card.id, 
              title: card.title,
              columnId: card.columnId // Log columnId to verify consistency
            }))
          })));
          
          boardTitle = message.data.title || 'Untitled Board';
          if (message.data.context) {
            webviewContext = message.data.context;
          }
          isLoading = false;
        }
        break;
      case 'cardAdded':
        if (message.data.success) {
          const { card, columnId } = message.data;
          log('Card added successfully from server', card);
          updateColumnCards(columnId, [...getColumnCards(columnId), card]);
        } else if (message.data.error) {
          error('Card add failed', message.data.error);
          // Restore from snapshot
          restoreFromSnapshot('addCard');
        }
        break;
      case 'cardUpdated':
        if (message.data.success) {
          const { card, columnId } = message.data;
          log('Card updated from server', card);
          
          // Find the column that currently contains the card
          const cardColumn = columns.find(col => 
            col.cards.some(c => c.id === card.id)
          );
          
          if (cardColumn && cardColumn.id !== columnId) {
            // The card has moved to a different column in the backend
            // Remove from current column and add to the correct one
            log('Card column mismatch detected', {
              currentColumnId: cardColumn.id,
              expectedColumnId: columnId,
              cardId: card.id
            });
            
            // Remove card from current column
            updateColumnCards(cardColumn.id, cardColumn.cards.filter(c => c.id !== card.id));
            
            // Add to correct column
            updateColumnCards(columnId, [...getColumnCards(columnId), card]);
          } else {
            // Standard update in the same column
            updateColumnCards(columnId, getColumnCards(columnId).map(c => c.id === card.id ? card : c));
            
            // Verify the update was applied
            const updatedCards = getColumnCards(columnId);
            const updatedCard = updatedCards.find(c => c.id === card.id);
            if (updatedCard) {
              log('Card successfully updated', { 
                title: updatedCard.title,
                cardId: updatedCard.id,
                columnId: updatedCard.columnId
              });
            }
          }
        } else if (message.data.error) {
          error('Card update failed', message.data.error);
          // Restore from snapshot
          restoreFromSnapshot('updateCard');
        }
        break;
      case 'cardDeleted':
        if (message.data.success) {
          const { cardId, columnId } = message.data;
          log('Card deleted', cardId);
          updateColumnCards(columnId, getColumnCards(columnId).filter(c => c.id !== cardId));
        } else if (message.data.error) {
          error('Card delete failed', message.data.error);
          // Restore from snapshot
          restoreFromSnapshot('deleteCard');
        }
        break;
      case 'cardMoved':
        if (message.data.success) {
          const { cardId, fromColumnId, toColumnId, card } = message.data;
          log('Card move confirmed by server', { cardId, fromColumnId, toColumnId });
          
          // If the server returned the updated card, use it directly
          if (card) {
            // Make sure the card is removed from the source column
            updateColumnCards(fromColumnId, getColumnCards(fromColumnId).filter(c => c.id !== cardId));
            
            // Check if the card already exists in the target column
            const existingCardIndex = getColumnCards(toColumnId).findIndex(c => c.id === cardId);
            if (existingCardIndex === -1) {
              // Card not in target column yet - add it
              updateColumnCards(toColumnId, [...getColumnCards(toColumnId), card]);
            } else {
              // Card already in target column - update it
              updateColumnCards(toColumnId, getColumnCards(toColumnId).map(c => c.id === cardId ? card : c));
            }
          }
        } else if (message.data.error) {
          error('Card move failed', message.data.error);
          // Restore from snapshot
          restoreFromSnapshot('moveCard');
        }
        break;
      case 'columnAdded':
        if (message.data.success) {
          const { column } = message.data;
          log('Column added', column);
          columns = [...columns, column];
        } else if (message.data.error) {
          error('Column add failed', message.data.error);
          // Restore from snapshot
          restoreFromSnapshot('addColumn');
        }
        break;
      case 'columnUpdated':
        if (message.data.success) {
          const { column } = message.data;
          log('Column updated', column);
          columns = columns.map(col => col.id === column.id ? column : col);
        } else if (message.data.error) {
          error('Column update failed', message.data.error);
          // Restore from snapshot
          restoreFromSnapshot('updateColumn');
        }
        break;
      case 'columnDeleted':
        if (message.data.success) {
          const { columnId } = message.data;
          log('Column deleted', columnId);
          columns = columns.filter(col => col.id !== columnId);
        } else if (message.data.error) {
          error('Column delete failed', message.data.error);
          // Restore from snapshot
          restoreFromSnapshot('deleteColumn');
        }
        break;
      default:
        log('Unknown message', message);
    }
  }

  function getColumnCards(columnId: string): Card[] {
    log('📊 getColumnCards called for columnId:', columnId);
    const column = columns.find(col => col.id === columnId);
    
    if (!column) {
      log('📊 Warning: Column not found with ID', columnId);
      return [];
    }
    
    log(`📊 Found column "${column.title}" with ${column.cards.length} cards`);
    return column ? column.cards : [];
  }

  function updateColumnCards(columnId: string, cards: Card[]) {
    log('📊 updateColumnCards called', { columnId, cardCount: cards.length });
    
    const originalColumn = columns.find(col => col.id === columnId);
    if (!originalColumn) {
      log('📊 Error: Cannot update cards - column not found', { columnId });
      return;
    }
    
    columns = columns.map(col => 
      col.id === columnId ? { ...col, cards } : col
    );
    
    log('📊 Column cards updated', { columnCount: columns.length });
  }

  function addCard(columnId: string) {
    log('Adding new card to column', { columnId });
    
    // Create snapshot before optimistic update
    createBoardSnapshot('addCard');
    
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

    // Optimistically update UI first
    updateColumnCards(columnId, [...getColumnCards(columnId), newCard]);
    log('Optimistically added card to UI', newCard);

    // Send message to extension
    sendMessage({
      command: 'addCard',
      data: { card: newCard, columnId, boardId }
    });
  }

  function handleCardMove(data: { cardId: string, fromColumnId: string, toColumnId: string, position?: number }) {
    const { cardId, fromColumnId, toColumnId, position } = data;

    // Create snapshot before optimistic update
    createBoardSnapshot('moveCard');

    // Optimistically update UI state
    const fromColumn = columns.find(col => col.id === fromColumnId);
    const toColumn = columns.find(col => col.id === toColumnId);
    
    if (fromColumn && toColumn) {
      const card = fromColumn.cards.find(c => c.id === cardId);
      if (card) {
        // Create a copy of the card with updated columnId to prevent state inconsistency
        const updatedCard = { 
          ...card,
          columnId: toColumnId, // Update the columnId to match the new column
          updatedAt: new Date().toISOString()
        };
        
        // Remove card from source column
        updateColumnCards(fromColumnId, fromColumn.cards.filter(c => c.id !== cardId));
        
        // Add card to target column at specified position or at the end
        let newCards;
        if (typeof position === 'number' && position >= 0 && position <= toColumn.cards.length) {
          // Insert at specific position
          newCards = [...toColumn.cards];
          newCards.splice(position, 0, updatedCard);
          log(`Optimistically moved card ${cardId} to position ${position} in column ${toColumnId}`);
        } else {
          // Append to end
          newCards = [...toColumn.cards, updatedCard];
          log(`Optimistically moved card ${cardId} to end of column ${toColumnId}`);
        }
        
        // Update order properties
        newCards.forEach((c, index) => {
          c.order = index;
        });
        
        updateColumnCards(toColumnId, newCards);
        
        log(`Optimistically moved card ${cardId} from column ${fromColumnId} to ${toColumnId} with updated columnId`);
      }
    }

    // Send message to extension
    sendMessage({
      command: 'moveCard',
      data: { cardId, fromColumnId, toColumnId, position, boardId }
    });
  }
  
  function addColumn() {
    // Create snapshot before optimistic update
    createBoardSnapshot('addColumn');
    
    const newColumn: ColumnData = {
      id: uuidv4(),
      title: 'New Column',
      cards: []
    };
    
    // Optimistically update UI
    columns = [...columns, newColumn];
    log('Optimistically added column to UI', newColumn);
    
    // Send message to extension
    sendMessage({
      command: 'addColumn',
      data: { column: newColumn, boardId }
    });
  }

  function updateColumn(column: ColumnData) {
    log('Updating column', column);
    
    // Create snapshot before optimistic update
    createBoardSnapshot('updateColumn');
    
    // Optimistically update UI
    columns = columns.map(col => col.id === column.id ? column : col);
    
    // Send message to extension
    sendMessage({
      command: 'updateColumn',
      data: { column, boardId }
    });
  }

  // New function that accepts columnId as parameter
  function handleUpdateColumn(columnId: string) {
    log('Handling column update', columnId);
    const column = columns.find(col => col.id === columnId);
    if (column) {
      updateColumn(column);
    } else {
      error(`Could not find column with ID ${columnId}`, null);
    }
  }

  function deleteColumn(columnId: string) {
    // Don't allow deleting the last column
    if (columns.length <= 1) {
      error('Cannot delete the last column in a board', null);
      return;
    }
    
    // Create snapshot before optimistic update
    createBoardSnapshot('deleteColumn');
    
    log('Deleting column', columnId);
    
    // Optimistically update UI
    columns = columns.filter(col => col.id !== columnId);
    
    // Send message to extension
    sendMessage({
      command: 'deleteColumn',
      data: { columnId, boardId }
    });
  }

  // Function to request board data with retries
  function requestBoardData(retryCount = 0) {
    log(`Requesting board data (attempt ${retryCount + 1})`);
    sendMessage({
      command: 'getBoard',
      data: { boardId }
    });
    
    // Retry a few times to ensure we get the latest data
    if (retryCount < 2) {
      setTimeout(() => {
        requestBoardData(retryCount + 1);
      }, 1000 * (retryCount + 1)); // Wait longer for each retry
    }
  }

  function handleCardUpdated(card: Card) {
    // Create snapshot before optimistic update
    createBoardSnapshot('updateCard');
    
    const column = columns.find(col => col.id === card.columnId);
    if (column) {
      updateColumnCards(card.columnId, column.cards.map(c => c.id === card.id ? card : c));
    }
  }

  function handleCardDeleted(cardId: string) {
    // Create snapshot before optimistic update
    createBoardSnapshot('deleteCard');
    
    const column = columns.find(col => col.cards.some(c => c.id === cardId));
    if (column) {
      updateColumnCards(column.id, column.cards.filter(c => c.id !== cardId));
    }
  }

  function handleAddCard(columnId: string) {
    log('🎯 handleAddCard called for column:', columnId);
    log('Opening new card form for column', { columnId });
    
    // Set the target column ID
    targetColumnId = columnId;
    log('🎯 Set targetColumnId to:', targetColumnId);
    
    // Reset form values
    newCardTitle = '';
    newCardDescription = '';
    newCardAssignee = '';
    newCardLabels = [];
    
    // Show the creation form
    isCreatingCard = true;
    log('🎯 Card creation form should now be visible, isCreatingCard =', isCreatingCard);
  }
  
  function createCard() {
    log('📝 createCard function called');
    
    if (!newCardTitle.trim()) {
      log('📝 Cannot create card: title is empty');
      log('Cannot create card: title is empty');
      return;
    }
    
    log('📝 Creating new card with values:', {
      title: newCardTitle,
      description: newCardDescription,
      assignee: newCardAssignee,
      labels: newCardLabels,
      columnId: targetColumnId,
      boardId: boardId
    });
    
    log('Creating new card for column', { columnId: targetColumnId });
    
    // Create snapshot before optimistic update
    createBoardSnapshot('addCard');
    
    const newCard: Card = {
      id: uuidv4(),
      title: newCardTitle,
      description: newCardDescription,
      labels: newCardLabels,
      assignee: newCardAssignee,
      columnId: targetColumnId,
      boardId,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    log('📝 Generated new card object:', newCard);

    // Optimistically update UI first
    updateColumnCards(targetColumnId, [...getColumnCards(targetColumnId), newCard]);
    log('Optimistically added card to UI', newCard);
    
    // Hide the form
    isCreatingCard = false;

    log('📝 Sending addCard message to extension');
    // Send message to extension
    sendMessage({
      command: 'addCard',
      data: { card: newCard, columnId: targetColumnId, boardId }
    });
    
    log('📝 Card creation process completed');
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

<div class="h-full {webviewContext === 'sidebar' ? 'sidebar-context' : ''}">
  {#if isLoading}
    <div class="flex items-center justify-center h-full">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 border-t-[var(--vscode-progressBar-background)] border-r-[var(--vscode-progressBar-background)] border-b-[var(--vscode-progressBar-background)] border-l-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-[var(--vscode-descriptionForeground)]">Loading board...</span>
      </div>
    </div>
  {:else}
    <div class="mb-4 flex justify-between items-center">
      <h2 class="text-lg font-medium text-[var(--vscode-foreground)]">{boardTitle}</h2>
      <button
        onclick={addColumn}
        class="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] flex items-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        Add Column
      </button>
    </div>
    
    {#if webviewContext === 'sidebar'}
      <!-- Sidebar layout: columns stacked vertically -->
      <div class="flex flex-col gap-4 min-h-screen">
        {#each columns as column (column.id)}
          <div class="flex-shrink-0 w-full">
            <Column
              id={column.id}
              title={column.title}
              cards={column.cards}
              boardId={boardId}
              onCardMoved={handleCardMove}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
              onAddCard={handleAddCard}
              onDeleteColumn={deleteColumn}
              onUpdateColumn={handleUpdateColumn}
            />
          </div>
        {/each}
      </div>
    {:else}
      <!-- Editor layout: columns side by side -->
      <div class="flex gap-4 min-h-screen overflow-x-auto pb-4">
        {#each columns as column (column.id)}
          <div class="flex-shrink-0 w-72">
            <Column
              id={column.id}
              title={column.title}
              cards={column.cards}
              boardId={boardId}
              onCardMoved={handleCardMove}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
              onAddCard={handleAddCard}
              onDeleteColumn={deleteColumn}
              onUpdateColumn={handleUpdateColumn}
            />
          </div>
        {/each}
        
        <!-- Add column placeholder -->
        <div class="flex-shrink-0 w-72 border border-dashed border-[var(--vscode-panel-border)] rounded-sm h-full flex items-center justify-center">
          <button
            onclick={addColumn}
            class="flex flex-col items-center justify-center p-4 w-full h-full text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-colors rounded-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span class="mt-2 text-sm">Add Column</span>
          </button>
        </div>
      </div>
    {/if}
    
    {#if columns.length === 0}
      <div class="flex flex-col items-center justify-center h-64 border border-dashed border-[var(--vscode-panel-border)] rounded-sm p-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--vscode-descriptionForeground)]">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <p class="mt-4 text-[var(--vscode-descriptionForeground)] text-sm">No columns found. Add a column to get started.</p>
        <button
          onclick={addColumn}
          class="mt-4 px-3 py-1.5 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        >
          Add Column
        </button>
      </div>
    {/if}
  {/if}

  <!-- Card Creation Modal -->
  {#if isCreatingCard}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-sm p-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-sm font-medium text-[var(--vscode-foreground)]">Create New Card</h2>
          <button
            onclick={cancelCardCreation}
            class="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <form
          onsubmit={(e: Event) => {
            e.preventDefault();
            createCard();
          }}
          class="space-y-3"
        >
          <div>
            <label for="card-title" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Title *</label>
            <!-- svelte-ignore a11y_autofocus -->
            <input
              type="text"
              id="card-title"
              bind:value={newCardTitle}
              class="w-full px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              placeholder="Enter card title"
              autofocus
            />
          </div>
          
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
          
          <div>
            <label for="new-label" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Labels</label>
            <div class="flex flex-wrap gap-1 mb-2">
              {#each newCardLabels as label}
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                  {label}
                  <button
                    type="button"
                    onclick={() => removeLabel(label)}
                    class="ml-1 text-[var(--vscode-badge-foreground)] hover:text-[var(--vscode-errorForeground)]"
                    aria-label="Remove label {label}"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </span>
              {/each}
            </div>
            <div class="flex gap-1">
              <input
                type="text"
                id="new-label"
                bind:value={newLabelInput}
                class="flex-1 px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-l-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
                placeholder="Add label..."
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLabel();
                  }
                }}
              />
              <button
                type="button"
                onclick={addLabel}
                class="px-2 py-1 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border border-[var(--vscode-button-secondaryBorder)] rounded-r-sm hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              >
                Add
              </button>
            </div>
          </div>
          
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onclick={cancelCardCreation}
              class="px-2 py-1 text-[var(--vscode-foreground)] border border-[var(--vscode-button-secondaryBorder)] bg-[var(--vscode-button-secondaryBackground)] rounded-sm hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
            >
              Cancel
            </button>
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