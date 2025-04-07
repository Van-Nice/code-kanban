<script lang="ts">
  import { v4 as uuidv4 } from 'uuid';
  import { onMount } from 'svelte';
  import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener } from '../utils/vscodeMessaging';

  export let onBoardSelect: (boardId: string) => void;

  interface Board {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  }

  let boards: Board[] = [];
  let newBoardTitle = '';
  let newBoardDescription = '';
  let isCreatingBoard = false;
  let messageHandler: (message: any) => void;

  onMount(() => {
    // Initialize VSCode API
    initializeVSCodeApi();
    
    // Set up message listener
    messageHandler = (message) => {
      handleExtensionMessage(message);
    };
    setupMessageListener(messageHandler);

    // Request boards from extension
    sendMessage({
      command: 'getBoards',
      data: {}
    });
  });

  function handleExtensionMessage(message: any) {
    switch (message.command) {
      case 'boardsLoaded':
        boards = message.data.boards;
        break;
      case 'boardCreated':
        if (message.data.success) {
          boards = [...boards, message.data.board];
          isCreatingBoard = false;
          newBoardTitle = '';
          newBoardDescription = '';
        }
        break;
      case 'boardDeleted':
        if (message.data.success) {
          boards = boards.filter(board => board.id !== message.data.boardId);
        }
        break;
      default:
        console.log('Unknown message:', message);
    }
  }

  function createBoard() {
    if (!newBoardTitle.trim()) return;

    const newBoard: Board = {
      id: uuidv4(),
      title: newBoardTitle,
      description: newBoardDescription,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Send message to extension
    sendMessage({
      command: 'createBoard',
      data: newBoard
    });
  }

  function deleteBoard(boardId: string, event: MouseEvent) {
    event.stopPropagation();
    
    // Send message to extension
    sendMessage({
      command: 'deleteBoard',
      data: { boardId }
    });
  }

  function openBoardInEditor(boardId: string, event: MouseEvent) {
    event.stopPropagation();
    
    // Send message to extension
    sendMessage({
      command: 'openBoardInEditor',
      data: { boardId }
    });
  }
</script>

<div class="p-4">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-xl font-medium text-[var(--vscode-foreground)]">Kanban Boards</h1>
    <button
      on:click={() => isCreatingBoard = true}
      class="px-3 py-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none"
    >
      Create New Board
    </button>
  </div>

  {#if isCreatingBoard}
    <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-md p-4 mb-4">
      <h2 class="text-sm font-medium text-[var(--vscode-foreground)] mb-3">Create New Board</h2>
      <div class="mb-3">
        <label for="board-title" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Title</label>
        <input
          type="text"
          id="board-title"
          bind:value={newBoardTitle}
          class="w-full px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:outline-none focus:border-[var(--vscode-focus-border)]"
          placeholder="Enter board title"
        />
      </div>
      <div class="mb-3">
        <label for="board-description" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Description (optional)</label>
        <textarea
          id="board-description"
          bind:value={newBoardDescription}
          class="w-full px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:outline-none focus:border-[var(--vscode-focus-border)]"
          rows="2"
          placeholder="Enter board description"
        ></textarea>
      </div>
      <div class="flex justify-end gap-2">
        <button
          on:click={() => isCreatingBoard = false}
          class="px-2 py-1 text-[var(--vscode-foreground)] border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none"
        >
          Cancel
        </button>
        <button
          on:click={createBoard}
          class="px-2 py-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none"
        >
          Create
        </button>
      </div>
    </div>
  {/if}

  {#if boards.length === 0}
    <div class="text-center py-8 text-[var(--vscode-descriptionForeground)]">
      <p class="mb-2">No boards found</p>
      <p class="text-sm">Create your first board to get started</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each boards as board (board.id)}
        <div 
          class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-md p-4 cursor-pointer hover:border-[var(--vscode-focus-border)] transition-colors"
          on:click={() => onBoardSelect(board.id)}
        >
          <div class="flex justify-between items-start">
            <h3 class="font-medium text-[var(--vscode-foreground)]">{board.title}</h3>
            <div class="flex gap-1">
              <button
                on:click={(e: MouseEvent) => openBoardInEditor(board.id, e)}
                class="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                title="Open in editor"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </button>
              <button
                on:click={(e: MouseEvent) => deleteBoard(board.id, e)}
                class="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-errorForeground)]"
                title="Delete board"
              >
                ×
              </button>
            </div>
          </div>
          {#if board.description}
            <p class="text-sm text-[var(--vscode-descriptionForeground)] mt-1">{board.description}</p>
          {/if}
          <div class="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            Updated: {new Date(board.updatedAt).toLocaleDateString()}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div> 