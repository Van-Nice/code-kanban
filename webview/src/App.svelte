<script lang="ts">
	import Board from './kanban/Board.svelte';
	import BoardList from './kanban/BoardList.svelte';
	import { onMount, onDestroy, tick } from 'svelte';
	import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext, log, error } from './utils/vscodeMessaging';
	import { Commands } from './shared/commands';
	import type { Board as SharedBoard } from './shared/types';
  
    let currentBoardId = $state<string | null>(null);
    let currentBoardData = $state<SharedBoard | null>(null);
    let messageHandler: (message: any) => void;
    let webviewContext: string;
    let theme = $state<string>('dark'); // Default theme
    let themeObserver: MutationObserver | null = null;
  
	onMount(() => {
	  log('App.svelte onMount: Initializing...');
	  // Initialize VSCode API
	  initializeVSCodeApi();
	  
	  // Get the webview context
	  webviewContext = getWebviewContext();
	  
	  // Set up message listener
	  messageHandler = (message) => {
		handleExtensionMessage(message);
	  };
	  log('App.svelte onMount: About to call setupMessageListener...');
	  setupMessageListener(messageHandler);
	  log('App.svelte onMount: setupMessageListener called.');
  
	  // Request initial state if in sidebar
	  if (webviewContext === 'sidebar') {
		log('Sidebar context detected, requesting initial state...');
		sendMessage({ command: 'requestInitialState' });
	  }
  
	  // Detect theme from VSCode
	  const body = document.body;
	  if (body.classList.contains('vscode-light')) {
		theme = 'light';
	  } else if (body.classList.contains('vscode-high-contrast')) {
		theme = 'high-contrast';
	  }
	  
	  // Listen for theme changes
	  themeObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
		  if (mutation.attributeName === 'class') {
			const body = document.body;
			if (body.classList.contains('vscode-light')) {
			  theme = 'light';
			} else if (body.classList.contains('vscode-high-contrast')) {
			  theme = 'high-contrast';
			} else {
			  theme = 'dark';
			}
		  }
		});
	  });
	  
	  themeObserver.observe(document.body, { attributes: true });
	});
	
	// Clean up all event listeners and observers
	onDestroy(() => {
	  log('App.svelte onDestroy: Cleaning up listener...');
	  // Clean up message listener
	  if (messageHandler) {
	    log('App: cleaning up message listener');
	    removeMessageListener(messageHandler);
	  }
	  
	  // Clean up theme observer
	  if (themeObserver) {
	    log('App: disconnecting theme observer');
	    themeObserver.disconnect();
	    themeObserver = null;
	  }
	});
  
	// Make the handler async to allow await tick()
	async function handleExtensionMessage(message: any) {
	  if (!message || !message.command) {
		log('Received invalid message', message);
		return;
	  }
  
	  switch (message.command) {
		case Commands.BOARD_LOADED:
		  if (message.data && message.data.success && message.data.board) {
			log('App received BOARD_LOADED, updating state', message.data.board);
			currentBoardData = message.data.board;
			currentBoardId = message.data.board.id;
		  } else {
			error('Failed to load board', message.data);
			currentBoardData = null;
		  }
		  break;
		case Commands.COLUMN_ADDED:
		case Commands.COLUMN_UPDATED:
		case Commands.COLUMN_DELETED:
		  // These messages are handled by the Board component
		  // DO NOT forward these messages - they're already coming from the extension
		  break;
		case Commands.CARD_UPDATED:
		case Commands.CARD_DELETED:
		case Commands.CARD_MOVED:
		  // These messages are handled by the Board component
		  // DO NOT forward these messages - they're already coming from the extension
		  break;
		case 'setState':
			// Read state from data object
			if (message.data && typeof message.data.boardId !== 'undefined') { // Check type explicitly
				const restoredBoardId = message.data.boardId;
				log('Extension sent state. Setting currentBoardId:', restoredBoardId);
				// Only update if the board ID has actually changed
				if (currentBoardId !== restoredBoardId) {
					currentBoardId = restoredBoardId;
					currentBoardData = null; // Reset data as we are loading a potentially new board or going to list
					if (currentBoardId) {
						// Trigger loading the board data if a valid boardId is set
						sendMessage({ command: Commands.GET_BOARD, data: { boardId: currentBoardId } });
					} 
				}
			} else {
				log('Received setState message with invalid/missing state data:', message.data);
			}
			break;
		case 'themeChanged':
		  // Read theme from data object
		  theme = message.data.theme;
		  break;
		case Commands.BOARDS_LOADED:
		case Commands.BOARD_CREATED:
		case Commands.BOARD_DELETED:
		  // These messages are handled by the BoardList component
		  break;
		case Commands.LOG:
		case Commands.ERROR:
		  // Ignore log and error messages
		  break;
		case Commands.COLUMN_ADDED:
		case "columnAdded":
		  log(`App received ${message.command} message - updating board state`, message.data);
		  if (message.data && message.data.success && message.data.column && currentBoardData) {
			const { column: newColumn, boardId } = message.data;

			// Ensure the message is for the currently loaded board
			if (currentBoardData.id === boardId) {
			  const updatedColumns = [...currentBoardData.columns, newColumn];
			  
			  // Sort columns by order just in case (optional, but good practice)
			  updatedColumns.sort((a, b) => a.order - b.order);
			  
			  currentBoardData = { ...currentBoardData, columns: updatedColumns };
			  log('App board state updated after COLUMN_ADDED');

			  // Ensure UI update after programmatic state change
			  await tick();

			} else {
			  log('COLUMN_ADDED message received for a different board, ignoring.', { currentBoard: currentBoardData.id, messageBoard: boardId });
			}
		  } else {
			log('COLUMN_ADDED message received but data is invalid or board not loaded.', message.data);
		  }
		  break;
		case Commands.COLUMN_UPDATED:
		  // Handle COLUMN_UPDATED (Example - Adapt as needed)
		  break;
		default:
		  // Only log unknown messages that aren't handled by child components
		  if (![
			Commands.BOARD_LOADED, 
			Commands.COLUMN_ADDED,
			Commands.COLUMN_UPDATED, 
			Commands.COLUMN_DELETED,
			Commands.CARD_UPDATED, 
			Commands.CARD_DELETED,
			Commands.CARD_MOVED
		  ].includes(message.command)) {
			log('Unknown message', message);
		  }
		  break;
	  }
	}
  
	function handleBoardSelect(boardId: string) {
	  log('Board selected', { boardId });
	  currentBoardId = boardId;
	  currentBoardData = null; // Reset board data while loading

	  // Send message to extension to get the board data
	  sendMessage({
		command: Commands.GET_BOARD,
		data: { boardId }
	  });

	  // Update URL without reloading the page
	  const url = new URL(window.location.href);
	  url.searchParams.set('boardId', boardId);
	  window.history.pushState({}, '', url);
	}
  
	function handleBackToBoards() {
	  log('Navigating back to boards list');
	  currentBoardId = null;
	  currentBoardData = null; // Clear board data when going back

	  // Send message to extension to clear its state
	  sendMessage({ command: 'handleBackToBoards' });

	  // Update URL without reloading the page
	  const url = new URL(window.location.href);
	  url.searchParams.delete('boardId');
	  window.history.pushState({}, '', url);
	}
  </script>
  
  <main class="min-h-screen bg-[var(--vscode-editor-background)]" data-theme={theme}>
	{#if currentBoardId}
	  <div class="p-4">
		<div class="mb-4 flex items-center">
		  <button
			onclick={handleBackToBoards}
			class="px-2 py-1 text-sm text-[var(--vscode-foreground)] border border-[var(--vscode-button-secondaryBorder)] bg-[var(--vscode-button-secondaryBackground)] rounded-sm hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] inline-flex items-center gap-1"
		  >
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			  <line x1="19" y1="12" x2="5" y2="12"></line>
			  <polyline points="12 19 5 12 12 5"></polyline>
			</svg>
			<span>Back to Boards</span>
		  </button>
		</div>
		{#key currentBoardId}
			{#if currentBoardData}
			<Board board={currentBoardData} />
			{:else}
			<p>Loading board data for {currentBoardId}...</p>
			{/if}
		{/key}
	  </div>
	{:else}
	  <BoardList onBoardSelect={handleBoardSelect} />
	{/if}
  </main>
  
  <style>
	:global(body) {
	  margin: 0;
	  font-family: var(--vscode-font-family);
	  color: var(--vscode-foreground);
	  background-color: var(--vscode-editor-background);
	  font-size: var(--vscode-font-size);
	  line-height: 1.5;
	}
  
	:global(button) {
	  font-family: inherit;
	  font-size: inherit;
	}
  
	:global(input), :global(select), :global(textarea) {
	  font-family: inherit;
	  font-size: inherit;
	}
	
	/* Adjust styles based on webview context */
	:global(.sidebar-context) {
	  max-width: 100%;
	  overflow-x: hidden;
	}
	
	/* Custom scrollbar styling to match VSCode */
	:global(::-webkit-scrollbar) {
	  width: 10px;
	  height: 10px;
	}
	
	:global(::-webkit-scrollbar-track) {
	  background: var(--vscode-scrollbarSlider-background);
	  border-radius: 3px;
	}
	
	:global(::-webkit-scrollbar-thumb) {
	  background: var(--vscode-scrollbarSlider-hoverBackground);
	  border-radius: 3px;
	}
	
	:global(::-webkit-scrollbar-thumb:hover) {
	  background: var(--vscode-scrollbarSlider-activeBackground);
	}
	
	/* Focus styles */
	:global(*:focus-visible) {
	  outline: 2px solid var(--vscode-focusBorder);
	  outline-offset: -1px;
	}
	
	/* Transitions */
	:global(.transition-all) {
	  transition-property: all;
	  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	  transition-duration: 150ms;
	}
  </style>