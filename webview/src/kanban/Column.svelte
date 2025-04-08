<script lang="ts">
  import Card from './Card.svelte';
  import { getWebviewContext } from '../utils/vscodeMessaging';
  import { createEventDispatcher } from 'svelte';

  const { id, title, cards = [], boardId, onAddCard } = $props<{
    id: string;
    title: string;
    cards?: any[];
    boardId: string;
    onAddCard: (columnId: string) => void;
  }>();

  const dispatch = createEventDispatcher();
  let webviewContext = getWebviewContext();
  let isDraggingOver = false;
  let dragOverIndex = -1;
  let isCollapsed = false; // Track collapse state
  let isHovered = false;

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
    isDraggingOver = false;
    dragOverIndex = -1;
    
    if (event.dataTransfer) {
      try {
        const cardData = JSON.parse(event.dataTransfer.getData('text/plain'));
        const cardId = cardData.cardId;
        const fromColumnId = cardData.fromColumnId;
        
        if (fromColumnId !== id) {
          dispatch('cardMove', { cardId, fromColumnId, toColumnId: id });
        }
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    }
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)] rounded-sm h-full flex flex-col {webviewContext === 'sidebar' ? 'mb-4' : ''} {isDraggingOver ? 'border-[var(--vscode-focusBorder)]' : ''} hover:border-[var(--vscode-panel-border)] transition-colors"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
>
  <div class="flex justify-between items-center p-2 border-b border-[var(--vscode-panel-border)]">
    <div class="flex items-center gap-2">
      <button 
        on:click={toggleCollapse}
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
      <h3 class="text-sm font-medium text-[var(--vscode-foreground)]">{title}</h3>
      <span class="text-xs text-[var(--vscode-descriptionForeground)] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-1.5 py-0.5 rounded-sm">
        {cards.length}
      </span>
    </div>
    <button 
      on:click={() => onAddCard(id)}
      class="w-5 h-5 flex items-center justify-center text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
      title="Add card"
      aria-label="Add card to column"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>
  
  {#if !isCollapsed}
    <div class="p-2 flex-1 overflow-y-auto space-y-2 cards-list">
      {#each cards as card, index (card.id)}
        <div 
          class="card-item relative transition-transform duration-100 hover:-translate-y-0.5 {isDraggingOver && dragOverIndex === index ? 'before:content-[""] before:absolute before:top-[-4px] before:left-0 before:right-0 before:h-[2px] before:bg-[var(--vscode-focusBorder)] before:z-10' : ''}"
        >
          <Card 
            {...card} 
            columnId={id}
            boardId={boardId}
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