<script lang="ts">
  import { sendMessage } from '../utils/vscodeMessaging';
  import { getWebviewContext } from '../utils/vscodeMessaging';
  import { onMount, onDestroy } from 'svelte';
  import { log, error } from '../utils/vscodeMessaging';
  import type { Card as CardType } from './types';
  import { Commands } from '../shared/commands';

  const { 
    id, 
    title, 
    description = '', 
    tags = [],
    columnId, 
    boardId,
    onUpdateCard, // Callback for updating the card
    onDeleteCard  // Callback for deleting the card
  } = $props<{
    id: string;
    title: string;
    description?: string;
    tags?: string[];
    columnId: string;
    boardId: string;
    onUpdateCard: (card: CardType) => void;
    onDeleteCard: (cardId: string) => void;
  }>();

  let isEditing = $state(false);
  let editedTitle = $state(title);
  let editedDescription = $state(description);
  let editedTags = $state([...tags]);
  let newTag = $state('');
  let webviewContext = getWebviewContext();
  let isDragging = $state(false);
  let cardTitleInput = $state<HTMLInputElement | null>(null);
  let isSaving = $state(false);
  let saveError = $state<string | null>(null);
  
  function startEditing() {
    isEditing = true;
    editedTitle = title;
    editedDescription = description;
    editedTags = [...tags];
  }

  onMount(() => {
    // Programmatic focus when editing starts
    $effect(() => {
      if (isEditing && cardTitleInput) {
        setTimeout(() => cardTitleInput?.focus(), 50);
      }
    });
  });
  
  onDestroy(() => {
    // Clean up any active timers
  });

  function saveChanges() {
    // Prevent multiple saves while one is in progress
    if (isSaving) {
      log('Save already in progress, ignoring duplicate save request');
      return;
    }
    
    log('saveChanges function called');
    
    if (!editedTitle.trim()) {
      log('Cannot save: title is empty');
      saveError = 'Title cannot be empty';
      return;
    }

    // Reset error state and set saving state
    saveError = null;
    isSaving = true;

    // Log edited values for debugging
    log('Card being saved with values:', { 
      editedTitle,
      originalTitle: title, 
      editedDescription, 
      hasChanged: editedTitle !== title || editedDescription !== description
    });
    
    // Create a copy of the card with updated values
    const updatedCard = {
      id, // Keep the same ID
      title: editedTitle, // Make sure we're using the edited title
      description: editedDescription,
      tags: editedTags,
      columnId,
      boardId,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      // Optimistically update UI and propagate change
      onUpdateCard(updatedCard); // Call the prop to notify parent
      isEditing = false;       // Exit editing mode
      isSaving = false;        // Reset saving state
      
    } catch (err) {
      isSaving = false;
      saveError = 'Failed to save card changes: ' + (err instanceof Error ? err.message : 'Unknown error');
      error('Error updating card', err);
      // Use VS Code notification API via message instead of alert
      sendMessage({
        command: Commands.SHOW_ERROR_MESSAGE,
        data: { message: 'Failed to save card changes. Please try again.' }
      });
    }
  }

  function cancelEditing() {
    isEditing = false;
  }

  function deleteCard() {
    // Send message to extension
    sendMessage({
      command: Commands.DELETE_CARD,
      data: { 
        cardId: id, 
        columnId,
        boardId
      }
    });
  }

  function addTag() {
    if (!newTag.trim()) return;
    if (editedTags.includes(newTag)) return;

    editedTags = [...editedTags, newTag];
    newTag = '';
  }

  function removeTag(tagToRemove: string) {
    editedTags = editedTags.filter(t => t !== tagToRemove);
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

<!-- Card Component Container -->
<!-- This is the root element of the Card component which serves as both the draggable item and interactive container -->
<!-- The element uses VS Code theme variables to match the IDE's styling for a native appearance -->
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
  <!-- Editing Mode - Displayed when isEditing is true -->
  {#if isEditing}
    <!-- Form for editing card details -->
    <!-- Prevents default form submission and handles saving via custom function -->
    <form 
      onsubmit={(e: Event) => {
        e.preventDefault();
        log('Form submitted with title:', editedTitle);
        saveChanges();
        return false;
      }}
      class="p-3 space-y-3"
    >
      <!-- Title Input Field -->
      <div>
        <label for="card-title" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Title</label>
        <!-- svelte-ignore a11y_autofocus - Ignore accessibility warning for autofocus -->
        <!-- Direct reference to DOM element for focus control -->
        <!-- Two-way binding to editedTitle state variable -->
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

      <!-- Description Textarea -->
      <!-- Two-way binding to editedDescription state variable -->
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

      <!-- Tags Section (was Labels) -->
      <div>
        <label for="card-tags" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Tags</label>
        <div class="flex flex-wrap gap-1 mb-1">
          {#each editedTags as tag (tag)}
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {tag}
              <button 
                type="button"
                onclick={() => removeTag(tag)} 
                class="ml-1.5 inline-flex text-blue-400 hover:text-blue-500 focus:outline-none focus:text-blue-500"
                aria-label="Remove tag: {tag}"
              >
                <svg class="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                  <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
                </svg>
              </button>
            </span>
          {/each}
        </div>
        <div class="flex">
          <input
            type="text"
            id="card-tags"
            bind:value={newTag}
            class="flex-grow px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-l-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
            placeholder="Add new tag..."
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
              e.stopPropagation();
            }}
          />
          <button 
            type="button" 
            onclick={addTag}
            class="px-3 py-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border border-[var(--vscode-button-border)] rounded-r-sm hover:bg-[var(--vscode-button-hoverBackground)] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            Add
          </button>
        </div>
      </div>

      <!-- Error Message Display -->
      {#if saveError}
        <p class="text-xs text-[var(--vscode-errorForeground)]">{saveError}</p>
      {/if}

      <!-- Action Buttons -->
      <div class="flex justify-end space-x-2 pt-2">
        <button 
          type="button" 
          onclick={cancelEditing} 
          class="px-3 py-1 text-sm bg-[var(--vscode-secondaryButton-background)] text-[var(--vscode-secondaryButton-foreground)] border border-[var(--vscode-secondaryButton-border)] rounded-sm hover:bg-[var(--vscode-secondaryButton-hoverBackground)] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={isSaving}
          class="px-3 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border border-[var(--vscode-button-border)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] disabled:opacity-50"
        >
          {#if isSaving}
            Saving...
          {:else}
            Save Changes
          {/if}
        </button>
      </div>
    </form>
  {:else}
    <!-- Non-Editing Mode -->
    <div class="p-3 cursor-grab" onclick={handleCardClick} role="button" aria-label="Edit card: {title}">
      <!-- Card Title -->
      <h3 class="text-sm font-medium text-[var(--vscode-foreground)] mb-1">{title}</h3>
      
      <!-- Card Description (if exists) -->
      {#if description}
        <p class="text-xs text-[var(--vscode-descriptionForeground)] mb-2">{description}</p>
      {/if}

      <!-- Tags Display (was Labels) -->
      <div class="flex flex-wrap gap-1">
        {#each tags as tag (tag)}
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {tag}
          </span>
        {/each}
      </div>

      <!-- Delete Button (visible on hover/focus) -->
      <!-- This button appears only when not editing and card is hovered/focused -->
      <!-- Positioned absolute in the top-right corner for easy access -->
      <button
        onclick={(e: MouseEvent) => {
          e.stopPropagation(); // Prevent the click from triggering edit mode
          deleteCard();
        }}
        aria-label="Delete card: {title}"
        class="absolute top-1 right-1 p-1 text-[var(--vscode-icon-foreground)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--vscode-errorForeground)] transition-opacity duration-150 rounded-full hover:bg-[var(--vscode-toolbar-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/if}
</div>

<style>
  /* Add a style to make the delete button visible on hover/focus of the parent card */
  div[role="button"]:hover > button[aria-label^="Delete card"],
  div[role="button"]:focus-within > button[aria-label^="Delete card"] {
    opacity: 1;
  }
</style>