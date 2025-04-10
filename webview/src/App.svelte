<script lang="ts">
	import Board from './kanban/Board.svelte';
	import BoardList from './kanban/BoardList.svelte';
	import { onMount } from 'svelte';
	import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext, log, error } from './utils/vscodeMessaging';
  
    let currentBoardId = $state<string | null>(null);
    let messageHandler: (message: any) => void;
    let webviewContext: string;
    let theme = $state<string>('dark'); // Default theme
  
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
  
	  // Check if we have a board ID in the URL
	  const urlParams = new URLSearchParams(window.location.search);
	  const boardId = urlParams.get('boardId');
	  if (boardId) {
		currentBoardId = boardId;
		log('Loaded board from URL', { boardId });
	  }
	  
	  // Check if we have a board ID in the window object (for editor view)
	  // @ts-ignore - window.boardId is injected by the extension
	  if (window.boardId) {
		// @ts-ignore
		currentBoardId = window.boardId;
		log('Loaded board from window object', { boardId: currentBoardId });
	  }
	  
	  // Detect theme from VSCode
	  const body = document.body;
	  if (body.classList.contains('vscode-light')) {
		theme = 'light';
	  } else if (body.classList.contains('vscode-high-contrast')) {
		theme = 'high-contrast';
	  }
	  
	  // Listen for theme changes
	  const observer = new MutationObserver((mutations) => {
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
	  
	  observer.observe(document.body, { attributes: true });
	  
	  return () => {
		observer.disconnect();
	  };
	});
  
	function handleExtensionMessage(message: any) {
	  if (!message || !message.command) {
		log('Received invalid message', message);
		return;
	  }
  
	  switch (message.command) {
		case 'boardLoaded':
		  // Handle board loaded message
		  if (message.data && message.data.success) {
			log('Board loaded successfully', message.data);
			// Forward the message to the Board component if we have a current board
			if (currentBoardId) {
			  sendMessage({
				command: message.command,
				data: message.data
			  });
			}
		  } else {
			error('Failed to load board', message.data);
		  }
		  break;
		case 'columnUpdated':
		case 'cardUpdated':
		case 'cardMoved':
		  // These messages are handled by the Board component
		  if (currentBoardId) {
			sendMessage({
			  command: message.command,
			  data: message.data
			});
		  }
		  break;
		case 'themeChanged':
		  theme = message.data.theme;
		  break;
		case 'boardsLoaded':
		case 'boardCreated':
		case 'boardDeleted':
		  // These messages are handled by the BoardList component
		  break;
		case 'log':
		case 'error':
		  // Ignore log and error messages
		  break;
		default:
		  // Only log unknown messages that aren't handled by child components
		  if (!['boardLoaded', 'columnUpdated', 'cardUpdated', 'cardMoved'].includes(message.command)) {
			log('Unknown message', message);
		  }
		  break;
	  }
	}
  
	function handleBoardSelect(boardId: string) {
	  log('Board selected', { boardId });
	  currentBoardId = boardId;
	  // Update URL without reloading the page
	  const url = new URL(window.location.href);
	  url.searchParams.set('boardId', boardId);
	  window.history.pushState({}, '', url);
	}
  
	function handleBackToBoards() {
	  log('Navigating back to boards list');
	  currentBoardId = null;
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
		<Board boardId={currentBoardId} />
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