<script lang="ts">
  import Card from './Card.svelte';
  import { createEventDispatcher } from 'svelte';
  import { getWebviewContext } from '../utils/vscodeMessaging';

  export let id: string;
  export let title: string;
  export let cards: any[] = [];
  export let boardId: string;

  const dispatch = createEventDispatcher();
  let webviewContext = getWebviewContext();

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
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

<div 
  class="bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)] rounded-md h-full flex flex-col {webviewContext === 'sidebar' ? 'mb-4' : ''}"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <div class="p-3 border-b border-[var(--vscode-panel-border)]">
    <h2 class="text-sm font-medium text-[var(--vscode-sideBarTitle-foreground)]">{title}</h2>
  </div>
  <div class="p-2 flex-1 overflow-y-auto space-y-2 {webviewContext === 'sidebar' ? 'max-h-[200px]' : 'min-h-[200px]'}">
    {#each cards as card (card.id)}
      <div draggable="true" on:dragstart={(e: DragEvent) => handleDragStart(e, card)}>
        <Card 
          {...card} 
          columnId={id}
          boardId={boardId}
        />
      </div>
    {/each}
  </div>
</div>
