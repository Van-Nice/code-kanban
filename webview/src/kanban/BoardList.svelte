<script lang="ts">
  import { v4 as uuidv4 } from 'uuid';
  import { onMount } from 'svelte';
  import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext, log, error } from '../utils/vscodeMessaging';

  const { onBoardSelect } = $props<{
    onBoardSelect: (boardId: string) => void;
  }>();

  interface Board {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  }

  let boards = $state<Board[]>([]);
  let newBoardTitle = $state('');
  let newBoardDescription = $state('');
  let isCreatingBoard = $state(false);
  let messageHandler: (message: any) => void;
  let webviewContext: string;
  let isLoading = $state(true);
  let searchQuery = $state('');

  let filteredBoards = $derived(
    searchQuery
      ? boards.filter(board =>
          board.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          board.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : boards
  );

  onMount(() => {
    // Initialize VSCode API
    initializeVSCodeApi();
    
    // Get the webview context
    webviewContext = getWebviewContext();
    
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
        isLoading = false;
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
        log('Unknown message', message);
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

  function deleteBoard(boardId: string, event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
    
    // Send message to extension
    sendMessage({
      command: 'deleteBoard',
      data: { boardId }
    });
  }

  function openBoardInEditor(boardId: string, event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
    
    // Send message to extension
    sendMessage({
      command: 'openBoardInEditor',
      data: { boardId }
    });
  }
  
</script>

<div class="p-4">
  <div class="flex justify-between items-center mb-4">
    <h1 class="text-xl font-medium text-[var(--vscode-foreground)]">Kanban Boards</h1>
    <button
      onclick={() => isCreatingBoard = true}
      class="px-3 py-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] flex items-center gap-1"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      New Board
    </button>
  </div>
  
  <div class="mb-4">
    <div class="relative">
      <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--vscode-input-placeholderForeground)]">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <input
        type="search"
        bind:value={searchQuery}
        class="w-full pl-10 pr-4 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        placeholder="Search boards..."
      />
    </div>
  </div>

  {#if isCreatingBoard}
    <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-sm p-4 mb-4">
      <h2 class="text-sm font-medium text-[var(--vscode-foreground)] mb-3">Create New Board</h2>
      <div class="mb-3">
        <label for="board-title" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Title</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          id="board-title"
          bind:value={newBoardTitle}
          class="w-full px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          placeholder="Enter board title"
          autofocus
        />
      </div>
      <div class="mb-3">
        <label for="board-description" class="block text-xs font-medium text-[var(--vscode-foreground)] mb-1">Description (optional)</label>
        <textarea
          id="board-description"
          bind:value={newBoardDescription}
          class="w-full px-2 py-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          rows="2"
          placeholder="Enter board description"
        ></textarea>
      </div>
      <div class="flex justify-end gap-2">
        <button
          onclick={() => isCreatingBoard = false}
          class="px-2 py-1 text-[var(--vscode-foreground)] border border-[var(--vscode-button-secondaryBorder)] bg-[var(--vscode-button-secondaryBackground)] rounded-sm hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        >
          Cancel
        </button>
        <button
          onclick={createBoard}
          class="px-2 py-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-sm hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
        >
          Create
        </button>
      </div>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 border-t-[var(--vscode-progressBar-background)] border-r-[var(--vscode-progressBar-background)] border-b-[var(--vscode-progressBar-background)] border-l-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-[var(--vscode-descriptionForeground)]">Loading boards...</span>
      </div>
    </div>
  {:else if filteredBoards.length === 0}
    <div class="text-center py-8 text-[var(--vscode-descriptionForeground)] border border-dashed border-[var(--vscode-panel-border)] rounded-sm">
      {#if searchQuery}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p class="mb-2">No boards match your search</p>
        <p class="text-sm">Try a different search term</p>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <p class="mb-2">No boards found</p>
        <p class="text-sm">Create your first board to get started</p>
      {/if}
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each filteredBoards as board (board.id)}
        <div 
          class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-sm p-4 cursor-pointer hover:border-[var(--vscode-focusBorder)] transition-colors text-left group"
          onclick={() => onBoardSelect(board.id)}
          onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onBoardSelect(board.id); }}
          tabindex="0"
          role="button"
          aria-label={`Select board ${board.title}`}
        >
          <div class="flex justify-between items-start">
            <h3 class="font-medium text-[var(--vscode-foreground)]">{board.title}</h3>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <!-- Open in editor button -->
              <button
              onclick={(e: MouseEvent) => { e.stopPropagation(); openBoardInEditor(board.id, e); }}
              onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  openBoardInEditor(board.id, e);
                }
              }}
                class="p-1 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
                title="Open in editor"
                aria-label="Open in editor"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </button>
              <!-- Delete button -->
              <button
                onclick={(e: MouseEvent) => { e.stopPropagation(); deleteBoard(board.id, e); }}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteBoard(board.id, e);
                  }
                }}
                class="p-1 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-errorForeground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
                title="Delete board"
                aria-label="Delete board"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
          {#if board.description}
            <p class="text-sm text-[var(--vscode-descriptionForeground)] mt-1">{board.description}</p>
          {/if}
          <div class="text-xs text-[var(--vscode-descriptionForeground)] mt-2 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Updated: {new Date(board.updatedAt).toLocaleDateString()}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>