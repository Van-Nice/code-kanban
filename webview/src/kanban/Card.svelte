<script lang="ts">
  import { v4 as uuidv4 } from 'uuid';
  import { sendMessage } from '../utils/vscodeMessaging';
  import { getWebviewContext } from '../utils/vscodeMessaging';

  export let id: string = uuidv4();
  export let title: string;
  export let description: string = '';
  export let labels: string[] = [];
  export let assignee: string = '';
  export let columnId: string;
  export let boardId: string;

  let isEditing = false;
  let editedTitle = title;
  let editedDescription = description;
  let editedLabels = [...labels];
  let editedAssignee = assignee;
  let newLabel = '';
  let webviewContext = getWebviewContext();
  let isDragging = false;

  function startEditing() {
    isEditing = true;
    editedTitle = title;
    editedDescription = description;
    editedLabels = [...labels];
    editedAssignee = assignee;
  }

  function saveChanges() {
    if (!editedTitle.trim()) return;

    const updatedCard = {
      id,
      title: editedTitle,
      description: editedDescription,
      labels: editedLabels,
      assignee: editedAssignee
    };

    // Send message to extension
    sendMessage({
      command: 'updateCard',
      data: { 
        card: updatedCard, 
        columnId,
        boardId
      }
    });

    isEditing = false;
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
      // Set a custom drag image if needed
      // const dragImage = document.createElement('div');
      // dragImage.textContent = title;
      // dragImage.style.opacity = '0.8';
      // document.body.appendChild(dragImage);
      // event.dataTransfer.setDragImage(dragImage, 0, 0);
      // setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  }

  function handleDragEnd() {
    isDragging = false;
  }
</script>

<div 
  class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded shadow-sm hover:border-[var(--vscode-focusBorder)] transition-all duration-200 ease-in-out {isDragging ? 'opacity-50 border-[var(--vscode-focusBorder)]' : ''}"
  on:dragstart={handleDragStart}
  on:dragend={handleDragEnd}
>
  {#if isEditing}
    <div class="p-3 space-y-3">
      <div>
        <label for="card-title" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Title</label>
        <input
          type="text"
          id="card-title"
          bind:value={editedTitle}
          class="w-full px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:outline-none focus:border-[var(--vscode-focusBorder)]"
        />
      </div>
      <div>
        <label for="card-description" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Description</label>
        <textarea
          id="card-description"
          bind:value={editedDescription}
          class="w-full px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:outline-none focus:border-[var(--vscode-focusBorder)]"
          rows="2"
        ></textarea>
      </div>
      <div>
        <label for="card-assignee" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Assignee</label>
        <input
          type="text"
          id="card-assignee"
          bind:value={editedAssignee}
          class="w-full px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:outline-none focus:border-[var(--vscode-focusBorder)]"
          placeholder="Assign to..."
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Labels</label>
        <div class="flex flex-wrap gap-1 mb-2">
          {#each editedLabels as label}
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {label}
              <button
                on:click={() => removeLabel(label)}
                class="ml-1 text-[var(--vscode-badge-foreground)] hover:text-[var(--vscode-errorForeground)]"
              >
                ×
              </button>
            </span>
          {/each}
        </div>
        <div class="flex gap-1">
          <input
            type="text"
            bind:value={newLabel}
            class="flex-1 px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-l focus:outline-none focus:border-[var(--vscode-focusBorder)]"
            placeholder="Add label..."
          />
          <button
            on:click={addLabel}
            class="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-r hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none"
          >
            Add
          </button>
        </div>
      </div>
      <div class="flex justify-between pt-2">
        <button
          on:click={deleteCard}
          class="px-2 py-1 text-sm text-[var(--vscode-errorForeground)] border border-[var(--vscode-errorForeground)] rounded hover:bg-[var(--vscode-errorForeground)] hover:text-[var(--vscode-editor-background)] focus:outline-none"
        >
          Delete
        </button>
        <div class="flex gap-2">
          <button
            on:click={cancelEditing}
            class="px-2 py-1 text-sm text-[var(--vscode-foreground)] border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none"
          >
            Cancel
          </button>
          <button
            on:click={saveChanges}
            class="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="p-3 cursor-pointer" on:click={startEditing}>
      <div class="flex justify-between items-start gap-2">
        <h3 class="text-sm font-medium text-[var(--vscode-foreground)] break-words">{title}</h3>
        <button
          on:click|stopPropagation={startEditing}
          class="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] flex-shrink-0"
          title="Edit card"
        >
          ✎
        </button>
      </div>
      {#if description}
        <p class="mt-1 text-xs text-[var(--vscode-descriptionForeground)] break-words">{description}</p>
      {/if}
      {#if labels.length > 0}
        <div class="flex flex-wrap gap-1 mt-2">
          {#each labels as label}
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {label}
            </span>
          {/each}
        </div>
      {/if}
      {#if assignee}
        <div class="mt-2 text-xs text-[var(--vscode-descriptionForeground)]">
          Assigned to: {assignee}
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
