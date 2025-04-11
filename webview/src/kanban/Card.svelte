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
    labels = [], 
    assignee = '', 
    columnId, 
    boardId,
    onUpdateCard, // Callback for updating the card
    onDeleteCard  // Callback for deleting the card
  } = $props<{
    id: string;
    title: string;
    description?: string;
    labels?: string[];
    assignee?: string;
    columnId: string;
    boardId: string;
    onUpdateCard: (card: CardType) => void;
    onDeleteCard: (cardId: string) => void;
  }>();

  let isEditing = $state(false);
  let editedTitle = $state(title);
  let editedDescription = $state(description);
  let editedLabels = $state([...labels]);
  let editedAssignee = $state(assignee);
  let newLabel = $state('');
  let webviewContext = getWebviewContext();
  let isDragging = $state(false);
  let cardTitleInput = $state<HTMLInputElement | null>(null);
  let isSaving = $state(false);
  let saveError = $state<string | null>(null);
  
  // Track active timers for cleanup
  let saveTimeout: number | undefined = undefined;
  let finalTimeout: number | undefined = undefined;

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
  
  onDestroy(() => {
    // Clean up any active timers
    cleanupSaveOperations();
  });
  
  function cleanupSaveOperations() {
    // Clear timeouts if active
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    
    if (finalTimeout) {
      clearTimeout(finalTimeout);
      finalTimeout = undefined;
    }
  }

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

    // Clean up any existing timers
    cleanupSaveOperations();

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
      labels: editedLabels,
      assignee: editedAssignee,
      columnId,
      boardId,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      // Send direct update message
      log('Sending card update to extension', updatedCard);
      sendMessage({
        command: Commands.UPDATE_CARD,
        data: { 
          card: updatedCard, 
          columnId,
          boardId
        }
      });
      
      // Instead of using a dynamic listener, we'll rely on the parent component
      // to handle the card update via the standard message flow, and we'll use
      // timers to handle timeouts.
      
      // Set up a timeout to detect if the update is taking too long
      saveTimeout = window.setTimeout(() => {
        if (isSaving) {
          // Still saving after timeout - might be an issue with the server
          log('Card save is taking longer than expected');
          log('First timeout reached (3s) - still waiting for response');
        }
      }, 3000);
        
      // Fallback - if after 10 seconds we haven't gotten a response, assume failure
      finalTimeout = window.setTimeout(() => {
        if (isSaving) {
          log('No update response received after timeout, manual check required');
          log('Final timeout reached (10s) - no response received');
          saveError = 'Update timed out. Please check if your changes were saved.';
          isSaving = false;
        }
      }, 10000);
      
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
  
  function handleSaveSuccess(updatedCard: CardType) {
    log('Card update confirmed by server', updatedCard);
    cleanupSaveOperations();
    isSaving = false;
    isEditing = false;
    onUpdateCard(updatedCard);
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

      <!-- Assignee Input Field -->
      <!-- Two-way binding to editedAssignee state variable -->
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

      <!-- Labels Section -->
      <div>
        <label for="new-label" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Labels</label>
        <!-- Container for displaying existing labels with remove buttons -->
        <div class="flex flex-wrap gap-1 mb-2">
          {#each editedLabels as label}
            <!-- Individual label badge with remove button -->
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {label}
              <!-- Remove label button -->
              <!-- Call removeLabel function with current label -->
              <button
                onclick={() => removeLabel(label)}
                class="ml-1 text-[var(--vscode-badge-foreground)] hover:text-[var(--vscode-errorForeground)]"
                aria-label="Remove label {label}"
              >
                <!-- X icon for removing label (SVG) -->
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </span>
          {/each}
        </div>
        <!-- Input group for adding new labels -->
        <div class="flex gap-1">
          <!-- New label text input with Enter key support -->
          <!-- Two-way binding to newLabel state variable -->
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
          <!-- Add label button -->
          <button
            onclick={addLabel}
            class="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-r-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            Add
          </button>
        </div>
      </div>

      <!-- Action Buttons Container -->
      <div class="flex justify-between pt-2">
        <!-- Delete Card Button (Left Side) -->
        <button
          type="button"
          onclick={(e: MouseEvent) => { 
            e.stopPropagation();
            deleteCard(); 
          }}          
          class="px-2 py-1 text-sm text-[var(--vscode-errorForeground)] border border-[var(--vscode-errorForeground)] rounded-sm hover:bg-[var(--vscode-errorForeground)] hover:text-[var(--vscode-editor-background)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-errorForeground)]"
        >
          <span class="flex items-center gap-1">
            <!-- Trash/Delete icon (SVG) -->
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
        
        <!-- Cancel and Save Buttons Container (Right Side) -->
        <div class="flex gap-2">
          <!-- Cancel Button -->
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
          <!-- Save Button -->
          <!-- Disable button when save operation is in progress -->
          <button
            type="button"
            onclick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isSaving) {
                log('Save button clicked, current title:', editedTitle);
                saveChanges();
              }
            }}
            class="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <!-- Error Message Display (conditional) -->
      {#if saveError}
        <div class="mt-2 text-[var(--vscode-errorForeground)] text-xs">
          Error: {saveError}
        </div>
      {/if}
    </form>
  <!-- Display Mode - Shown when not in edit mode -->
  {:else}
    <!-- Card content container that serves as click target for editing -->
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
      <!-- Card Header with Title and Edit Button -->
      <div class="flex justify-between items-start gap-2">
        <!-- Card Title -->
        <h3 class="text-sm font-medium text-[var(--vscode-foreground)] break-words">{title}</h3>
        <!-- Edit Button (pencil icon) -->
        <button
          onclick={(e: MouseEvent) => { e.stopPropagation(); startEditing(); }}          
          title="Edit card"
          aria-label="Edit card"
        >
          <!-- Edit/Pencil icon (SVG) -->
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>

      <!-- Card Description (conditional) -->
      {#if description}
        <p class="mt-1 text-xs text-[var(--vscode-descriptionForeground)] break-words">{description}</p>
      {/if}

      <!-- Card Labels (conditional) -->
      {#if labels.length > 0}
        <div class="flex flex-wrap gap-1 mt-2">
          {#each labels as label}
            <!-- Label badge without delete button in display mode -->
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {label}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Card Assignee (conditional) -->
      {#if assignee}
        <div class="mt-2 text-xs text-[var(--vscode-descriptionForeground)] flex items-center gap-1">
          <!-- User/Person icon (SVG) -->
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

<!-- Scoped CSS for Card Component -->
<style>
  /* Add smooth transition effect to all div elements within this component */
  div {
    transition: all 0.2s ease;
  }
</style>