<script lang="ts">
  import Card from './Card.svelte';
  import { getWebviewContext } from '../utils/vscodeMessaging';
  import type { Card as CardType, Column as ColumnType } from '../types';
  import { log, error } from '../utils/vscodeMessaging';
  import { onMount, onDestroy } from 'svelte';
  import { Commands } from '../shared/commands';

  const { id, title, cards = [], boardId, onCardMoved, onCardUpdated, onCardDeleted, onAddCard, onDeleteColumn, onUpdateColumn } = $props<{
    id: string;
    title: string;
    cards?: CardType[];
    boardId: string;
    onCardMoved: (data: { cardId: string, fromColumnId: string, toColumnId: string, position: number }) => void;
    onCardUpdated: (card: CardType) => void;
    onCardDeleted: (cardId: string) => void;
    onAddCard: (columnId: string) => void;
    onUpdateColumn: (column: ColumnType) => void;
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
  let columnElement: HTMLElement; // Reference to the root element
  let clickHandler: (e: MouseEvent) => void;

  onMount(() => {
    // Consolidated event delegation for clicks
    clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Add card button
      if (target.closest('[data-action="add-card"]')) {
        e.preventDefault();
        e.stopPropagation();
        onAddCard(id);
        return;
      }

      // Column title
      if (target.closest('.column-title')) {
        e.preventDefault();
        e.stopPropagation();
        startEditingTitle();
        return;
      }

      // Collapse/expand button
      if (target.closest('.collapse-btn')) {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse();
        return;
      }

      // Menu button
      if (target.closest('.menu-btn')) {
        e.preventDefault();
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        return;
      }

      // Card interactions
      const cardItem = target.closest('.card-item');
      if (cardItem) {
        const cardId = cardItem.getAttribute('data-card-id');
        if (!cardId) {
          log('Error: Card ID not found');
          return;
        }

        // Only handle deletion here - let Card component handle other interactions
        if (target.closest('.delete-card-btn')) {
          e.preventDefault();
          e.stopPropagation();
          handleCardDelete(cardId);
          return;
        }
      }
    };

    // Attach all event listeners to columnElement
    columnElement.addEventListener('click', clickHandler);
    columnElement.addEventListener('dragover', handleDragOver);
    columnElement.addEventListener('dragleave', handleDragLeave);
    columnElement.addEventListener('drop', handleDrop);
  });

  onDestroy(() => {
    // Clean up all event listeners
    if (clickHandler && columnElement) {
      columnElement.removeEventListener('click', clickHandler);
      columnElement.removeEventListener('dragover', handleDragOver);
      columnElement.removeEventListener('dragleave', handleDragLeave);
      columnElement.removeEventListener('drop', handleDrop);
    }
  });

  function handleCardDelete(cardId: string) {
    log('Delete card clicked:', cardId);
    onCardDeleted(cardId);
  }

  function handleCardEdit(cardId: string) {
    // Card component handles its own editing
    log('Card editing handled by Card component');
  }

  function handleCardClick(cardId: string) {
    // Card component handles its own clicks
    log('Card clicks handled by Card component');
  }

  $effect(() => {
    editedTitle = title;
  });

  function startEditingTitle() {
    editedTitle = title;
    isEditingTitle = true;
  }

  function saveColumnTitle() {
    const trimmedTitle = editedTitle.trim();
    if (!trimmedTitle) {
      editedTitle = title; // Reset to original title
      isEditingTitle = false;
      return;
    }

    if (trimmedTitle === title) {
      isEditingTitle = false;
      return;
    }

    log('Updating column title', { oldTitle: title, newTitle: trimmedTitle });
    // Create updated column data with new title
    const updatedColumn = {
      id,
      title: trimmedTitle,
      cards: cardsList,
      order: 0 // Preserve existing order if needed
    };
    
    // Pass the updated column data to the parent
    onUpdateColumn(updatedColumn);
    isEditingTitle = false;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
      isDraggingOver = true;

      const cardsContainer = event.currentTarget as HTMLElement;
      const cardsListEl = cardsContainer.querySelector('.cards-list') as HTMLElement;
      if (cardsListEl) {
        const cardElements = cardsListEl.querySelectorAll('.card-item');
        const mouseY = event.clientY;

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

        dragOverIndex = mouseY > cardsListEl.getBoundingClientRect().bottom ? cards.length : closestIndex;
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
        const { cardId, fromColumnId } = cardData;
        if (fromColumnId !== id) {
          const position = dragOverIndex >= 0 ? dragOverIndex : cardsList.length;
          log(`Dropping card ${cardId} at position ${position} in column ${id}`);
          onCardMoved({ cardId, fromColumnId, toColumnId: id, position });
        }
      } catch (err) {
        console.error('Error parsing drag data:', err);
      }
    }
    isDraggingOver = false;
    dragOverIndex = -1;
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }
</script>

<!-- Column Component Container -->
<!-- This is the main container for each column in the Kanban board -->
<!-- It uses bind:this to get a direct reference to the DOM element for manipulation -->
<!-- Visual styling changes when being hovered over or when a card is being dragged over it -->
<div
  bind:this={columnElement}
  role="region"
  aria-label="Kanban column: {title}"
  class="bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)] rounded-sm h-full flex flex-col {webviewContext === 'sidebar' ? 'mb-4' : ''} {isDraggingOver ? 'border-[var(--vscode-focusBorder)]' : ''} hover:border-[var(--vscode-panel-border)] transition-colors"
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  <!-- Column Header Section -->
  <!-- Contains column title, card count, collapse/expand button, and action buttons -->
  <div class="flex justify-between items-center p-2 border-b border-[var(--vscode-panel-border)]">
    <!-- Left side of header with title and collapse button -->
    <div class="flex items-center gap-2">
      <!-- Collapse/Expand Toggle Button -->
      <!-- Changes icon based on current collapse state -->
      <button
        class="collapse-btn w-5 h-5 flex items-center justify-center text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        title={isCollapsed ? 'Expand' : 'Collapse'}
        aria-label={isCollapsed ? 'Expand column' : 'Collapse column'}
      >
        <!-- Dynamic SVG icon that changes based on column collapsed state -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          {#if isCollapsed}
            <!-- Right-pointing chevron for collapsed state -->
            <polyline points="9 18 15 12 9 6"></polyline>
          {:else}
            <!-- Down-pointing chevron for expanded state -->
            <polyline points="6 9 12 15 18 9"></polyline>
          {/if}
        </svg>
      </button>

      <!-- Column Title - Switches between edit mode and display mode -->
      {#if isEditingTitle}
        <!-- Title Edit Form - Shown when user is editing the column title -->
        <!-- Submits on enter key or when input loses focus -->
        <form
          class="flex-1"
          onsubmit={(e: Event) => {
            e.preventDefault();
            saveColumnTitle();
            return false;
          }}
        >
          <!-- Column Title Input Field -->
          <!-- Uses two-way binding to edit the title in state -->
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
        <!-- Column Title Display - Shows clickable title text when not in edit mode -->
        <h3
          class="column-title text-sm font-medium text-[var(--vscode-foreground)] cursor-pointer hover:text-[var(--vscode-textLink-foreground)]"
          title="Click to edit column title"
        >{title}</h3>
      {/if}

      <!-- Card Count Badge -->
      <!-- Shows the number of cards in this column in a visual badge -->
      <span class="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-1.5 py-0.5 rounded-sm">
        {cards.length}
      </span>
    </div>
    
    <!-- Right side of header with action buttons -->
    <div class="flex">
      <!-- Add Card Button -->
      <!-- Triggers the card creation process for this column -->
      <button
        data-action="add-card"
        class="w-5 h-5 flex items-center justify-center text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        title="Add card"
        aria-label="Add card to column"
      >
        <!-- Plus icon for adding a new card (SVG) -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <!-- Column Options Menu -->
      <!-- A dropdown menu for column-level operations -->
      <div class="relative ml-1">
        <!-- Menu Toggle Button -->
        <button
          class="menu-btn w-5 h-5 flex items-center justify-center text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          title="More options"
          aria-label="Column options"
        >
          <!-- Vertical dots (ellipsis) icon for menu (SVG) -->
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>

        <!-- Dropdown Menu - Conditionally rendered when menu is open -->
        {#if isMenuOpen}
          <div class="absolute right-0 mt-1 w-48 bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-dropdown-border)] shadow-lg rounded-sm z-10">
            <ul>
              <!-- Edit Column Title Option -->
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
              <!-- Delete Column Option - Only shown if callback is provided -->
              {#if onDeleteColumn}
                <li>
                  <button
                    class="w-full text-left px-4 py-2 text-sm text-[var(--vscode-errorForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus:outline-none focus:bg-[var(--vscode-list-focusBackground)]"
                    onclick={() => {
                      log('Delete column button clicked for column:', id);
                      // Remove confirm dialog which might be blocking the event flow
                      log('Directly calling onDeleteColumn for column:', id);
                      onDeleteColumn(id);
                      log('onDeleteColumn callback called for column:', id);
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

  <!-- Column Content Section -->
  <!-- Contains all cards in this column or collapsed indicator -->
  {#if !isCollapsed}
    <!-- Cards Container - Scrollable list of all cards in this column -->
    <div class="p-2 flex-1 overflow-y-auto space-y-2 cards-list">
      <!-- Loop through all cards and render them -->
      {#each cardsList as card, index (card.id)}
        <!-- Individual Card Wrapper -->
        <!-- Adds visual indicators for drag-and-drop targets -->
        <div
          class="card-item relative transition-transform duration-100 hover:-translate-y-0.5 {isDraggingOver && dragOverIndex === index ? 'before:content-[""] before:absolute before:top-[-4px] before:left-0 before:right-0 before:h-[2px] before:bg-[var(--vscode-focusBorder)] before:z-10' : ''}"
          data-card-id={card.id}
        >
          <!-- Card Component -->
          <!-- Renders the actual card UI and handles card-level interactions -->
          <!-- Passes callbacks to handle data changes that bubble up to the column -->
          <Card
            {...card}
            columnId={id}
            onUpdateCard={(updatedCard) => {
              log('Card update received in column', updatedCard);
              cardsList = cardsList.map((c: CardType) => c.id === updatedCard.id ? updatedCard : c);
              onCardUpdated(updatedCard);
            }}
            onDeleteCard={(cardId) => {
              log('Card delete received in column', cardId);
              cardsList = cardsList.filter((c: CardType) => c.id !== cardId);
              onCardDeleted(cardId);
            }}
          />
        </div>
      {/each}

      <!-- Drag Target Indicator -->
      <!-- Shows a line when dragging over the bottom position in the column -->
      {#if isDraggingOver && dragOverIndex === cards.length}
        <div class="h-1 my-2 rounded bg-[var(--vscode-focusBorder)]"></div>
      {/if}

      <!-- Empty Column State -->
      <!-- Shown when the column has no cards -->
      {#if cards.length === 0}
        <div class="text-center py-4 text-[var(--vscode-descriptionForeground)] text-xs italic border border-dashed border-[var(--vscode-panel-border)] rounded-sm">
          Drop cards here
        </div>
      {/if}
    </div>
  <!-- Collapsed View -->
  <!-- Shows a simple indicator of how many cards are hidden when column is collapsed -->
  {:else}
    <div class="p-2 text-center text-[var(--vscode-descriptionForeground)] text-xs">
      {cards.length} {cards.length === 1 ? 'card' : 'cards'} hidden
    </div>
  {/if}
</div>