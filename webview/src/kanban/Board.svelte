<script lang="ts">
  import Column from './Column.svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { onMount, onDestroy } from 'svelte';
  import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext, log, error } from '../utils/vscodeMessaging';
  import type { Card } from '../types';

  const { boardId } = $props<{
    boardId: string;
  }>();

  interface ColumnData {
    id: string;
    title: string;
    cards: Card[];
  }

  let columns = $state<ColumnData[]>([]);
  let messageHandler: (message: any) => void;
  let webviewContext = $state<string>('');
  let isLoading = $state(true);
  let boardTitle = $state('');

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
            cards: col.cards.map(card => ({ id: card.id, title: card.title }))
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
          log('Card added', card);
          updateColumnCards(columnId, [...getColumnCards(columnId), card]);
        }
        break;
      case 'cardUpdated':
        if (message.data.success) {
          const { card, columnId } = message.data;
          log('Card updated', card);
          // First log the card that's being replaced
          const currentCards = getColumnCards(columnId);
          const existingCard = currentCards.find(c => c.id === card.id);
          if (existingCard) {
            log('Replacing card', { 
              oldTitle: existingCard.title, 
              newTitle: card.title,
              cardId: card.id
            });
          } else {
            log('Card not found in column', { columnId, cardId: card.id });
          }
          
          // Update the cards in the column
          updateColumnCards(columnId, getColumnCards(columnId).map(c => c.id === card.id ? card : c));
          
          // Verify the update was applied
          const updatedCards = getColumnCards(columnId);
          const updatedCard = updatedCards.find(c => c.id === card.id);
          if (updatedCard) {
            log('Card successfully updated', { 
              title: updatedCard.title,
              cardId: updatedCard.id 
            });
          } else {
            error('Failed to find updated card after update', { columnId, cardId: card.id });
          }
        } else if (message.data.error) {
          error('Card update failed', message.data.error);
        }
        break;
      case 'cardDeleted':
        if (message.data.success) {
          const { cardId, columnId } = message.data;
          log('Card deleted', cardId);
          updateColumnCards(columnId, getColumnCards(columnId).filter(c => c.id !== cardId));
        }
        break;
      case 'cardMoved':
        if (message.data.success) {
          const { cardId, fromColumnId, toColumnId } = message.data;
          const card = getColumnCards(fromColumnId).find(c => c.id === cardId);
          if (card) {
            updateColumnCards(fromColumnId, getColumnCards(fromColumnId).filter(c => c.id !== cardId));
            updateColumnCards(toColumnId, [...getColumnCards(toColumnId), card]);
          }
        }
        break;
      default:
        log('Unknown message', message);
    }
  }

  function getColumnCards(columnId: string): Card[] {
    const column = columns.find(col => col.id === columnId);
    return column ? column.cards : [];
  }

  function updateColumnCards(columnId: string, cards: Card[]) {
    columns = columns.map(col => 
      col.id === columnId ? { ...col, cards } : col
    );
  }

  function addCard(columnId: string) {
    log('Adding new card to column', { columnId });
    
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

    // Send message to extension
    sendMessage({
      command: 'addCard',
      data: { card: newCard, columnId, boardId }
    });
  }

  function handleCardMove(data: { cardId: string, fromColumnId: string, toColumnId: string }) {
    const { cardId, fromColumnId, toColumnId } = data;

    // Optimistically update UI state
    const fromColumn = columns.find(col => col.id === fromColumnId);
    const toColumn = columns.find(col => col.id === toColumnId);
    
    if (fromColumn && toColumn) {
      const card = fromColumn.cards.find(c => c.id === cardId);
      if (card) {
        // Remove card from source column
        updateColumnCards(fromColumnId, fromColumn.cards.filter(c => c.id !== cardId));
        // Add card to target column
        updateColumnCards(toColumnId, [...toColumn.cards, card]);
        
        log(`Optimistically moved card ${cardId} from column ${fromColumnId} to ${toColumnId}`);
      }
    }

    // Send message to extension
    sendMessage({
      command: 'moveCard',
      data: { cardId, fromColumnId, toColumnId, boardId }
    });
  }
  
  function addColumn() {
    const newColumn: ColumnData = {
      id: uuidv4(),
      title: 'New Column',
      cards: []
    };
    
    // Send message to extension
    sendMessage({
      command: 'addColumn',
      data: { column: newColumn, boardId }
    });
    
    // Optimistically update UI
    columns = [...columns, newColumn];
  }

  // Function to request board data with retries
  function requestBoardData(retryCount = 0) {
    console.log(`Requesting board data (attempt ${retryCount + 1})`);
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
    const column = columns.find(col => col.id === card.columnId);
    if (column) {
      updateColumnCards(card.columnId, column.cards.map(c => c.id === card.id ? card : c));
    }
  }

  function handleCardDeleted(cardId: string) {
    const column = columns.find(col => col.cards.some(c => c.id === cardId));
    if (column) {
      updateColumnCards(column.id, column.cards.filter(c => c.id !== cardId));
    }
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
              onAddCard={addCard}
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
              onAddCard={addCard}
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