<script lang="ts">
  import Card from './Card.svelte';
  import { createEventDispatcher } from 'svelte';
  import { getWebviewContext } from '../utils/vscodeMessaging';

  export let id: string;
  export let title: string;
  export let cards: any[] = [];
  export let boardId: string;
  export let onAddCard: (columnId: string) => void;

  const dispatch = createEventDispatcher();
  let webviewContext = getWebviewContext();
  let isDraggingOver = false;
  let dragOverIndex = -1;

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
      const cardData = JSON.parse(event.dataTransfer.getData('text/plain'));
      const cardId = cardData.cardId;
      const fromColumnId = cardData.fromColumnId;
      
      if (fromColumnId !== id) {
        dispatch('cardMove', { cardId, fromColumnId, toColumnId: id });
      }
    }
  }

  function handleDragStart(event: DragEvent, card: any) {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({
        cardId: card.id,
        fromColumnId: id
      }));
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)] rounded-md h-full flex flex-col {webviewContext === 'sidebar' ? 'mb-4' : ''} {isDraggingOver ? 'border-[var(--vscode-focusBorder)]' : ''}"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <div class="flex justify-between items-center mb-3">
    <h3 class="text-base font-medium text-[var(--vscode-foreground)]">{title}</h3>
    <button 
      on:click={() => onAddCard(id)}
      class="ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none"
    >
      +
    </button>
  </div>

  <div class="p-2 flex-1 overflow-y-auto space-y-2 {webviewContext === 'sidebar' ? 'max-h-[200px]' : 'min-h-[200px]'} cards-list">
    {#each cards as card, index (card.id)}
      <div 
        class="card-item relative transition-transform duration-100 hover:-translate-y-0.5 {isDraggingOver && dragOverIndex === index ? 'before:content-[""] before:absolute before:top-[-4px] before:left-0 before:right-0 before:h-[2px] before:bg-[var(--vscode-focusBorder)] before:z-10' : ''}"
        draggable="true" 
        on:dragstart={(e: DragEvent) => handleDragStart(e, card)}
      >
        <Card 
          {...card} 
          columnId={id}
          boardId={boardId}
        />
      </div>
    {/each}
    
    {#if isDraggingOver && dragOverIndex === cards.length}
      <div class="h-2 my-2 rounded bg-[var(--vscode-focusBorder)]"></div>
    {/if}
  </div>
</div>
