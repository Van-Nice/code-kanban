<script lang="ts">
  import Card from './Card.svelte';
  import { getWebviewContext } from '../utils/vscodeMessaging';
  import type { Card as CardType } from '../types';
  import { log, error } from '../utils/vscodeMessaging';
  import { createEventDispatcher } from 'svelte';

  // Define the ColumnData type
  interface ColumnData {
    id: string;
    title: string;
    cards: CardType[];
  }

  const { id, title, cards = [], boardId, onCardMoved, onCardUpdated, onCardDeleted, onAddCard, onDeleteColumn } = $props<{
    id: string;
    title: string;
    cards?: CardType[];
    boardId: string;
    onCardMoved: (data: { cardId: string, fromColumnId: string, toColumnId: string, position: number }) => void;
    onCardUpdated: (card: CardType) => void;
    onCardDeleted: (cardId: string) => void;
    onAddCard: (columnId: string) => void;
    onDeleteColumn?: (columnId: string) => void;
  }>();

  let cardsList = $state(cards);
  let webviewContext = getWebviewContext();
  let isDraggingOver = $state(false);
  let dragOverIndex = $state(-1);
  let isCollapsed = $state(false);
  let isHovered = $state(false);
  let isEditingTitle = $state(false);
  let editedTitle = $state(title);
  let isMenuOpen = $state(false);
  
  // Watch for title prop changes
  $effect(() => {
    editedTitle = title;
  });
  
  function startEditingTitle() {
    editedTitle = title;
    isEditingTitle = true;
  }
  
  function saveColumnTitle() {
    if (!editedTitle.trim()) {
      log('Cannot save column: title is empty');
      return;
    }
    
    const updatedColumn = {
      id,
      title: editedTitle,
      cards: cardsList
    };
    
    log('Updating column title', { oldTitle: title, newTitle: editedTitle });
    isEditingTitle = false;
    
    // Optimistically update local state
    cardsList = [...cardsList];
    
    // Forward to parent component
    dispatch('updateColumn', { column: updatedColumn });
  }

  const dispatch = createEventDispatcher<{
    updateColumn: { column: ColumnData };
  }>();

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
      isDraggingOver = true;
      
      // Calculate the drop position based on mouse position
      const cardsContainer = event.currentTarget as HTMLElement;
      const cardsList = cardsContainer.querySelector('.cards-list') as HTMLElement;
      if (cardsList) {
        const cardElements = cardsList.querySelectorAll('.card-item');
        const mouseY = event.clientY;
        
        // Find the closest card element based on mouse position
        let closestIndex = -1;
        let closestDistance = Infinity;
        
        cardElements.forEach((cardElement, index) => {
          const rect = cardElement.getBoundingClientRect();
          const cardMiddle = rect.top + rect.height / 2;
          const distance = Math.abs(mouseY - cardMiddle);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });
        
        // If mouse is below all cards, set to append at the end
        if (mouseY > cardsList.getBoundingClientRect().bottom) {
          dragOverIndex = cards.length;
        } else {
          dragOverIndex = closestIndex;
        }
      }
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDraggingOver = false;
    dragOverIndex = -1;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    
    if (event.dataTransfer) {
      try {
        const cardData = JSON.parse(event.dataTransfer.getData('text/plain'));
        const cardId = cardData.cardId;
        const fromColumnId = cardData.fromColumnId;
        
        if (fromColumnId !== id) {
          // Determine the position for insertion based on drop position
          const position = dragOverIndex >= 0 ? dragOverIndex : cardsList.length;
          
          log(`Dropping card ${cardId} at position ${position} in column ${id}`);
          
          // Pass position information to the card move handler
          onCardMoved({ 
            cardId, 
            fromColumnId, 
            toColumnId: id,
            position 
          });
        }
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    }
    
    // Reset drag state
    isDraggingOver = false;
    dragOverIndex = -1;
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }

  function handleExtensionMessage(message: any) {
    log('Column received message', message);
    
    switch (message.command) {
      case 'cardAdded':
        if (message.data.success && message.data.columnId === id) {
          const { card } = message.data;
          log('Card added to column', card);
          cardsList = [...cardsList, card];
        }
        break;
      case 'cardUpdated':
        if (message.data.success && message.data.columnId === id) {
          const { card } = message.data;
          log('Card updated in column', card);
          cardsList = cardsList.map((c: CardType) => c.id === card.id ? card : c);
        }
        break;
      case 'cardDeleted':
        if (message.data.success && message.data.columnId === id) {
          const { cardId } = message.data;
          log('Card deleted from column', cardId);
          cardsList = cardsList.filter((c: CardType) => c.id !== cardId);
        }
        break;
      case 'cardMoved':
        if (message.data.success) {
          const { cardId, fromColumnId, toColumnId } = message.data;
          if (fromColumnId === id) {
            log('Card moved from column', cardId);
            cardsList = cardsList.filter((c: CardType) => c.id !== cardId);
          } else if (toColumnId === id) {
            const card = message.data.card;
            log('Card moved to column', card);
            cardsList = [...cardsList, card];
          }
        }
        break;
      default:
        log('Unknown message', message);
    }
  }
</script>

<div
  role="region"
  aria-label="Kanban column: {title}"
  class="bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)] rounded-sm h-full flex flex-col {webviewContext === 'sidebar' ? 'mb-4' : ''} {isDraggingOver ? 'border-[var(--vscode-focusBorder)]' : ''} hover:border-[var(--vscode-panel-border)] transition-colors"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  <div class="flex justify-between items-center p-2 border-b border-[var(--vscode-panel-border)]">
    <div class="flex items-center gap-2">
      <button 
        onclick={toggleCollapse}
        class="w-5 h-5 flex items-center justify-center text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        title={isCollapsed ? "Expand" : "Collapse"}
        aria-label={isCollapsed ? "Expand column" : "Collapse column"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          {#if isCollapsed}
            <polyline points="9 18 15 12 9 6"></polyline>
          {:else}
            <polyline points="6 9 12 15 18 9"></polyline>
          {/if}
        </svg>
      </button>
      
      {#if isEditingTitle}
        <form 
          class="flex-1"
          onsubmit={(e: Event) => {
            e.preventDefault();
            saveColumnTitle();
            return false;
          }}
        >
          <input 
            type="text" 
            bind:value={editedTitle}
            class="w-full px-2 py-0.5 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
            autofocus
            onblur={() => saveColumnTitle()}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Escape') {
                isEditingTitle = false;
                editedTitle = title;
              }
            }}
          />
        </form>
      {:else}
        <h3 
          class="text-sm font-medium text-[var(--vscode-foreground)] cursor-pointer hover:text-[var(--vscode-textLink-foreground)]"
          onclick={startEditingTitle}
          title="Click to edit column title"
        >{title}</h3>
      {/if}
      
      <span class="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-1.5 py-0.5 rounded-sm">
        {cards.length}
      </span>
    </div>
    <div class="flex">
      <button 
        onclick={() => onAddCard(id)}
        class="w-5 h-5 flex items-center justify-center text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        title="Add card"
        aria-label="Add card to column"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      
      <div class="relative ml-1">
        <button 
          onclick={() => isMenuOpen = !isMenuOpen}
          class="w-5 h-5 flex items-center justify-center text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          title="More options"
          aria-label="Column options"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>
        
        {#if isMenuOpen}
          <div class="absolute right-0 mt-1 w-48 bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-dropdown-border)] shadow-lg rounded-sm z-10">
            <ul>
              <li>
                <button 
                  class="w-full text-left px-4 py-2 text-sm text-[var(--vscode-dropdown-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] focus:outline-none focus:bg-[var(--vscode-list-focusBackground)]"
                  onclick={() => {
                    startEditingTitle();
                    isMenuOpen = false;
                  }}
                >
                  Edit column title
                </button>
              </li>
              {#if onDeleteColumn}
                <li>
                  <button 
                    class="w-full text-left px-4 py-2 text-sm text-[var(--vscode-errorForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus:outline-none focus:bg-[var(--vscode-list-focusBackground)]"
                    onclick={() => {
                      if (confirm('Are you sure you want to delete this column and all its cards?')) {
                        onDeleteColumn(id);
                      }
                      isMenuOpen = false;
                    }}
                  >
                    Delete column
                  </button>
                </li>
              {/if}
            </ul>
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  {#if !isCollapsed}
    <div class="p-2 flex-1 overflow-y-auto space-y-2 cards-list">
      {#each cardsList as card, index (card.id)}
        <div 
          class="card-item relative transition-transform duration-100 hover:-translate-y-0.5 {isDraggingOver && dragOverIndex === index ? 'before:content-[""] before:absolute before:top-[-4px] before:left-0 before:right-0 before:h-[2px] before:bg-[var(--vscode-focusBorder)] before:z-10' : ''}"
        >
          <Card 
            {...card} 
            columnId={id}
            on:update={(event) => {
              const updatedCard = event.detail.card;
              log('Card update event received in column', updatedCard);
              // Update local state
              cardsList = cardsList.map((c: CardType) => c.id === updatedCard.id ? updatedCard : c);
              // Notify board component
              onCardUpdated(updatedCard);
            }}
            on:delete={(event) => {
              const cardId = event.detail.cardId;
              log('Card delete event received in column', cardId);
              cardsList = cardsList.filter((c: CardType) => c.id !== cardId);
              onCardDeleted(cardId);
            }}
          />
        </div>
      {/each}
      
      {#if isDraggingOver && dragOverIndex === cards.length}
        <div class="h-1 my-2 rounded bg-[var(--vscode-focusBorder)]"></div>
      {/if}
      
      {#if cards.length === 0}
        <div class="text-center py-4 text-[var(--vscode-descriptionForeground)] text-xs italic border border-dashed border-[var(--vscode-panel-border)] rounded-sm">
          Drop cards here
        </div>
      {/if}
    </div>
  {:else}
    <div class="p-2 text-center text-[var(--vscode-descriptionForeground)] text-xs">
      {cards.length} {cards.length === 1 ? 'card' : 'cards'} hidden
    </div>    
  {/if}
</div>