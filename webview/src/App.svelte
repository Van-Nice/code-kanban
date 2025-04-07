<script lang="ts">
	import Board from './kanban/Board.svelte';
	import BoardList from './kanban/BoardList.svelte';
	import { onMount } from 'svelte';
	import { initializeVSCodeApi, sendMessage, setupMessageListener, removeMessageListener, getWebviewContext } from './utils/vscodeMessaging';

	let currentBoardId: string | null = null;
	let messageHandler: (message: any) => void;
	let webviewContext: string;

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
		}
		
		// Check if we have a board ID in the window object (for editor view)
		// @ts-ignore - window.boardId is injected by the extension
		if (window.boardId) {
			// @ts-ignore
			currentBoardId = window.boardId;
		}
	});

	function handleExtensionMessage(message: any) {
		switch (message.command) {
			case 'boardLoaded':
				if (message.data.success) {
					// Board data loaded successfully
				}
				break;
			default:
				console.log('Unknown message:', message);
		}
	}

	function handleBoardSelect(boardId: string) {
		currentBoardId = boardId;
		// Update URL without reloading the page
		const url = new URL(window.location.href);
		url.searchParams.set('boardId', boardId);
		window.history.pushState({}, '', url);
	}

	function handleBackToBoards() {
		currentBoardId = null;
		// Update URL without reloading the page
		const url = new URL(window.location.href);
		url.searchParams.delete('boardId');
		window.history.pushState({}, '', url);
	}
</script>

<main class="min-h-screen bg-[var(--vscode-editor-background)]">
	{#if currentBoardId}
		<div class="p-4">
			<div class="mb-4 flex items-center">
				<button
					on:click={handleBackToBoards}
					class="px-2 py-1 text-sm text-[var(--vscode-foreground)] border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none inline-flex items-center gap-1"
				>
					<span>←</span>
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
	}

	:global(button) {
		font-family: inherit;
	}

	:global(input), :global(select), :global(textarea) {
		font-family: inherit;
	}
</style>