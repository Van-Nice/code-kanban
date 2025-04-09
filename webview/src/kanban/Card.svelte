<script lang="ts">
  import { v4 as uuidv4 } from 'uuid';
  import { sendMessage } from '../utils/vscodeMessaging';
  import { getWebviewContext } from '../utils/vscodeMessaging';
  import { onMount, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  const { id, title, description = '', labels = [], assignee = '', columnId, boardId } = $props<{
    id: string;
    title: string;
    description?: string;
    labels?: string[];
    assignee?: string;
    columnId: string;
    boardId: string;
  }>();

  // Debug log props
  console.log('Card component initialized with props:', { id, title, description, labels, assignee, columnId, boardId });
  
  // Add to window for debugging
  try {
    // @ts-ignore
    if (!window._debugData) {
      // @ts-ignore
      window._debugData = {};
    }
    // @ts-ignore
    window._debugData.cardProps = { id, title, description, labels, assignee, columnId, boardId };
    console.log('Card props added to window._debugData for console debugging');
  } catch (e) {
    console.error('Failed to add debug data to window:', e);
  }

  let isEditing = $state(false);
  let editedTitle = $state(title);
  let editedDescription = $state(description);
  let editedLabels = $state([...labels]);
  let editedAssignee = $state(assignee);
  let newLabel = $state('');
  let webviewContext = getWebviewContext();
  let isDragging = $state(false);
  let cardTitleInput = $state<HTMLInputElement | null>(null);

  function startEditing() {
    isEditing = true;
    editedTitle = title;
    editedDescription = description;
    editedLabels = [...labels];
    editedAssignee = assignee;
  }


  onMount(() => {
    // Programmatic focus when editing starts
    $effect(() => {
      if (isEditing && cardTitleInput) {
        setTimeout(() => cardTitleInput?.focus(), 50);
      }
    });
  });

  function saveChanges() {
    console.log('saveChanges function called');
    
    if (!editedTitle.trim()) {
      console.log('Cannot save: title is empty');
      return;
    }

    // Create a copy of the card with updated values
    const updatedCard = {
      id, // Keep the same ID
      title: editedTitle,
      description: editedDescription,
      labels: editedLabels,
      assignee: editedAssignee
    };
    
    try {
      // Store card data in a global variable to ensure it persists
      // @ts-ignore
      window._pendingCardUpdate = {
        card: updatedCard,
        columnId,
        boardId
      };
      
      // WORKAROUND: Use delete + add instead of update
      // First delete the original card
      console.log('WORKAROUND: Deleting card to simulate update', id);
      sendMessage({
        command: 'deleteCard',
        data: { 
          cardId: id, 
          columnId,
          boardId
        }
      });
      
      // Then add a new card with the same ID but updated values
      // Use a longer timeout to ensure delete completes first
      const addCardFunction = () => {
        // @ts-ignore
        const pendingUpdate = window._pendingCardUpdate;
        if (!pendingUpdate) {
          console.error('No pending update found!');
          return;
        }
        
        console.log('WORKAROUND: Adding updated card', pendingUpdate.card.id);
        sendMessage({
          command: 'addCard',
          data: pendingUpdate
        });
        
        // Call this function again if the message might have failed
        // @ts-ignore
        window._addCardRetryCount = (window._addCardRetryCount || 0) + 1;
        // @ts-ignore
        if (window._addCardRetryCount < 3) {
          setTimeout(addCardFunction, 500);
        }
        
        // Update UI optimistically
        try {
          dispatch('cardUpdate', { 
            card: pendingUpdate.card, 
            columnId: pendingUpdate.columnId
          });
        } catch (e) {
          // Ignore dispatch errors
        }
      };
      
      // Set multiple timeouts to ensure the message gets through
      setTimeout(addCardFunction, 300);
      setTimeout(addCardFunction, 800);
      setTimeout(addCardFunction, 1500);
      
      isEditing = false;
    } catch (error) {
      console.error('Error updating card:', error);
      alert('Failed to save card changes. Please try again.');
    }
  }

  function cancelEditing() {
    isEditing = false;
  }

  function deleteCard() {
    // Send message to extension
    sendMessage({
      command: 'deleteCard',
      data: { 
        cardId: id, 
        columnId,
        boardId
      }
    });
  }

  function addLabel() {
    if (!newLabel.trim()) return;
    if (editedLabels.includes(newLabel)) return;

    editedLabels = [...editedLabels, newLabel];
    newLabel = '';
  }

  function removeLabel(label: string) {
    editedLabels = editedLabels.filter(l => l !== label);
  }

  function handleDragStart(event: DragEvent) {
    isDragging = true;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', JSON.stringify({
        cardId: id,
        fromColumnId: columnId
      }));
    }
  }

  function handleDragEnd() {
    isDragging = false;
  }
  
  function handleCardClick() {
    startEditing();
  }
</script>

<div
  role="button"
  tabindex="0"
  aria-label="Draggable card: {title}"
  class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-sm shadow-sm hover:shadow-md transition-all duration-200 ease-in-out {isDragging ? 'opacity-50 border-[var(--vscode-focusBorder)]' : ''} hover:border-[var(--vscode-focusBorder)]"
  ondragstart={handleDragStart}
  ondragend={handleDragEnd}
  draggable={!isEditing}
  onkeydown={(e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startEditing();
    }
  }}
>
  {#if isEditing}
    <form 
      onsubmit={(e: Event) => {
        e.preventDefault();
        console.log('Form submitted through onsubmit handler');
        saveChanges();
        return false;
      }}
      class="p-3 space-y-3"
    >
      <div>
        <label for="card-title" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Title</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          id="card-title"
          bind:this={cardTitleInput}
          bind:value={editedTitle}
          class="w-full px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          autofocus
          onkeydown={(e: KeyboardEvent) => {
            e.stopPropagation();
          }}
        />
      </div>
      <div>
        <label for="card-description" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Description</label>
        <textarea
          id="card-description"
          bind:value={editedDescription}
          class="w-full px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          rows="2"
          onkeydown={(e: KeyboardEvent) => {
            e.stopPropagation();
          }}
        ></textarea>
      </div>
      <div>
        <label for="card-assignee" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Assignee</label>
        <input
          type="text"
          id="card-assignee"
          bind:value={editedAssignee}
          class="w-full px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          placeholder="Assign to..."
          onkeydown={(e: KeyboardEvent) => {
            e.stopPropagation();
          }}
        />
      </div>
      <div>
        <label for="new-label" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Labels</label>
        <div class="flex flex-wrap gap-1 mb-2">
          {#each editedLabels as label}
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {label}
              <button
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
            bind:value={newLabel}
            id="new-label"
            class="flex-1 px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-l-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
            placeholder="Add label..."
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLabel();
              }
            }}
          />
          <button
            onclick={addLabel}
            class="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-r-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            Add
          </button>
        </div>
      </div>
      <div class="flex justify-between pt-2">
        <button
          type="button"
          onclick={(e: MouseEvent) => { 
            e.stopPropagation(); 
            deleteCard(); 
          }}          
          class="px-2 py-1 text-sm text-[var(--vscode-errorForeground)] border border-[var(--vscode-errorForeground)] rounded-sm hover:bg-[var(--vscode-errorForeground)] hover:text-[var(--vscode-editor-background)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-errorForeground)]"
        >
          <span class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            Delete
          </span>
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              cancelEditing();
            }}
            class="px-2 py-1 text-sm text-[var(--vscode-foreground)] border border-[var(--vscode-button-secondaryBorder)] bg-[var(--vscode-button-secondaryBackground)] rounded-sm hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Save button clicked');
              saveChanges();
            }}
            class="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            Save
          </button>
          <button
            type="button"
            onclick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Debug Save clicked');
              
              try {
                // Create the update message directly
                const updatedCard = {
                  id,
                  title: editedTitle,
                  description: editedDescription,
                  labels: editedLabels,
                  assignee: editedAssignee
                };
                
                // Store update in global variable
                // @ts-ignore
                window._pendingCardUpdate = {
                  card: updatedCard,
                  columnId,
                  boardId
                };
                
                // WORKAROUND: Use delete + add instead of update
                console.log('DEBUG WORKAROUND: Deleting card to simulate update', id);
                sendMessage({
                  command: 'deleteCard',
                  data: { 
                    cardId: id, 
                    columnId,
                    boardId
                  }
                });
                
                // Force addCard with multiple retries
                const addCardFunction = () => {
                  // @ts-ignore
                  const pendingUpdate = window._pendingCardUpdate;
                  if (!pendingUpdate) {
                    console.error('No pending debug update found!');
                    return;
                  }
                  
                  console.log('DEBUG WORKAROUND: Adding updated card', pendingUpdate.card.id);
                  sendMessage({
                    command: 'addCard',
                    data: pendingUpdate
                  });
                  
                  alert(`Debug Save: Card update message sent (try ${Date.now()})`);
                };
                
                // Set multiple timeouts to ensure the message gets through
                setTimeout(addCardFunction, 300);
                setTimeout(addCardFunction, 1000);
                setTimeout(addCardFunction, 2000);
                
                isEditing = false;
              } catch (error) {
                console.error('Error in Debug Save:', error);
                alert('Error: ' + String(error));
              }
            }}
            class="px-2 py-1 text-sm bg-[var(--vscode-warningBackground)] text-[var(--vscode-warningForeground)] rounded-sm hover:bg-[var(--vscode-errorBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            Debug Save
          </button>
        </div>
      </div>
    </form>
  {:else}
    <div
      role="button"
      tabindex="0"
      class="p-3 cursor-pointer"
      onclick={startEditing}
      onkeydown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEditing();
        }
      }}
    >
      <div class="flex justify-between items-start gap-2">
        <h3 class="text-sm font-medium text-[var(--vscode-foreground)] break-words">{title}</h3>
        <button
          onclick={(e: MouseEvent) => { e.stopPropagation(); startEditing(); }}          title="Edit card"
          aria-label="Edit card"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>
      {#if description}
        <p class="mt-1 text-xs text-[var(--vscode-descriptionForeground)] break-words">{description}</p>
      {/if}
      {#if labels.length > 0}
        <div class="flex flex-wrap gap-1 mt-2">
          {#each labels as label}
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {label}
            </span>
          {/each}
        </div>
      {/if}
      {#if assignee}
        <div class="mt-2 text-xs text-[var(--vscode-descriptionForeground)] flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          {assignee}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  div {
    transition: all 0.2s ease;
  }
</style>