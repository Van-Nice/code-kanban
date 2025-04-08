<script lang="ts">
  import Column from './Column.svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { onMount, onDestroy } from 'svelte';
  import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext } from '../utils/vscodeMessaging';

  const { boardId } = $props<{
    boardId: string;
  }>();

  interface Card {
    id: string;
    title: string;
    description: string;
    labels: string[];
    assignee: string;
  }

  interface ColumnData {
    id: string;
    title: string;
    cards: Card[];
  }

  let columns: ColumnData[] = [
    { id: 'todo', title: 'To Do', cards: [] },
    { id: 'in-progress', title: 'In Progress', cards: [] },
    { id: 'done', title: 'Done', cards: [] }
  ];

  let messageHandler: (message: any) => void;
  let webviewContext: string;

  onMount(() => {
    // Initialize VSCode API
    initializeVSCodeApi();
    
    // Get the webview context
    webviewContext = getWebviewContext();
    
    // Set up message listener
    messageHandler = (message) => {
      handleExtensionMessage(message);
    };
    setupMessageListener(messageHandler);

    // Request board data from extension
    sendMessage({
      command: 'getBoard',
      data: { boardId }
    });
  });

  onDestroy(() => {
    // Clean up message listener
    if (messageHandler) {
      removeMessageListener(messageHandler);
    }
  });

  function handleExtensionMessage(message: any) {
    switch (message.command) {
      case 'boardLoaded':
        if (message.data.success) {
          columns = message.data.columns;
          if (message.data.context) {
            webviewContext = message.data.context;
          }
        }
        break;
      case 'cardAdded':
        if (message.data.success) {
          const { card, columnId } = message.data;
          updateColumnCards(columnId, [...getColumnCards(columnId), card]);
        }
        break;
      case 'cardUpdated':
        if (message.data.success) {
          const { card, columnId } = message.data;
          updateColumnCards(columnId, getColumnCards(columnId).map(c => c.id === card.id ? card : c));
        }
        break;
      case 'cardDeleted':
        if (message.data.success) {
          const { cardId, columnId } = message.data;
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
        console.log('Unknown message:', message);
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
    const newCard: Card = {
      id: uuidv4(),
      title: 'New Card',
      description: '',
      labels: [],
      assignee: ''
    };

    // Send message to extension
    sendMessage({
      command: 'addCard',
      data: { card: newCard, columnId, boardId }
    });
  }

  function handleCardMove(event: CustomEvent) {
    const { cardId, fromColumnId, toColumnId } = event.detail;

    // Send message to extension
    sendMessage({
      command: 'moveCard',
      data: { cardId, fromColumnId, toColumnId, boardId }
    });
  }
</script>

<div class="h-full {webviewContext === 'sidebar' ? 'sidebar-context' : ''}">
  {#if webviewContext === 'sidebar'}
    <!-- Sidebar layout: columns stacked vertically -->
    <div class="flex flex-col gap-4 p-4 min-h-screen">
      {#each columns as column (column.id)}
        <div class="flex-shrink-0 w-full">
          <Column
            id={column.id}
            title={column.title}
            cards={column.cards}
            boardId={boardId}
            onAddCard={addCard}
            on:cardMove={handleCardMove}
          />
        </div>
      {/each}
    </div>
  {:else}
    <!-- Editor layout: columns side by side -->
    <div class="flex gap-4 p-4 min-h-screen">
      {#each columns as column (column.id)}
        <div class="flex-shrink-0 w-72">
          <Column
            id={column.id}
            title={column.title}
            cards={column.cards}
            boardId={boardId}
            onAddCard={addCard}
            on:cardMove={handleCardMove}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>
