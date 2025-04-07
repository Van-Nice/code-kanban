import * as vscode from "vscode";

export interface WebviewMessage {
  command: string;
  data?: any;
}

// Store for boards data
interface Board {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  columns: Column[];
}

interface Column {
  id: string;
  title: string;
  cards: Card[];
}

interface Card {
  id: string;
  title: string;
  description: string;
  labels: string[];
  assignee: string;
}

// Storage key for boards in VSCode's global storage
const BOARDS_STORAGE_KEY = "boogie.boards";

export class MessageHandler {
  private webview: vscode.Webview;
  private context: vscode.ExtensionContext;

  constructor(webview: vscode.Webview, context: vscode.ExtensionContext) {
    this.webview = webview;
    this.context = context;
  }

  // Get boards from storage
  private getBoards(): Board[] {
    return this.context.globalState.get<Board[]>(BOARDS_STORAGE_KEY, []);
  }

  // Save boards to storage
  private async saveBoards(boards: Board[]): Promise<void> {
    await this.context.globalState.update(BOARDS_STORAGE_KEY, boards);
  }

  public async handleMessage(message: WebviewMessage): Promise<void> {
    console.log("Received message from webview:", message);

    switch (message.command) {
      case "getBoards":
        // Return all boards from storage
        const boards = this.getBoards();
        this.sendMessage({
          command: "boardsLoaded",
          data: { boards },
        });
        break;

      case "getBoard":
        // Return a specific board from storage
        const allBoards = this.getBoards();
        const board = allBoards.find((b) => b.id === message.data.boardId);
        if (board) {
          this.sendMessage({
            command: "boardLoaded",
            data: {
              success: true,
              columns: board.columns,
            },
          });
        } else {
          this.sendMessage({
            command: "boardLoaded",
            data: {
              success: false,
              error: "Board not found",
            },
          });
        }
        break;

      case "createBoard":
        // Create a new board and save to storage
        const newBoard: Board = {
          ...message.data,
          columns: [
            { id: "todo", title: "To Do", cards: [] },
            { id: "in-progress", title: "In Progress", cards: [] },
            { id: "done", title: "Done", cards: [] },
          ],
        };
        const updatedBoards = [...this.getBoards(), newBoard];
        await this.saveBoards(updatedBoards);
        this.sendMessage({
          command: "boardCreated",
          data: {
            success: true,
            board: newBoard,
          },
        });
        break;

      case "deleteBoard":
        // Delete a board from storage
        const boardsToUpdate = this.getBoards();
        const boardIndex = boardsToUpdate.findIndex(
          (b) => b.id === message.data.boardId
        );
        if (boardIndex !== -1) {
          boardsToUpdate.splice(boardIndex, 1);
          await this.saveBoards(boardsToUpdate);
          this.sendMessage({
            command: "boardDeleted",
            data: {
              success: true,
              boardId: message.data.boardId,
            },
          });
        } else {
          this.sendMessage({
            command: "boardDeleted",
            data: {
              success: false,
              error: "Board not found",
            },
          });
        }
        break;

      case "addCard":
        // Add a card to a board's column and save to storage
        const boardsForAdd = this.getBoards();
        const targetBoard = boardsForAdd.find(
          (b) => b.id === message.data.boardId
        );
        if (targetBoard) {
          const column = targetBoard.columns.find(
            (c) => c.id === message.data.columnId
          );
          if (column) {
            column.cards.push(message.data.card);
            targetBoard.updatedAt = new Date().toISOString();
            await this.saveBoards(boardsForAdd);
            this.sendMessage({
              command: "cardAdded",
              data: {
                success: true,
                card: message.data.card,
                columnId: message.data.columnId,
              },
            });
          } else {
            this.sendMessage({
              command: "cardAdded",
              data: {
                success: false,
                error: "Column not found",
              },
            });
          }
        } else {
          this.sendMessage({
            command: "cardAdded",
            data: {
              success: false,
              error: "Board not found",
            },
          });
        }
        break;

      case "updateCard":
        // Update a card in a board's column and save to storage
        const boardsForUpdate = this.getBoards();
        const boardToUpdate = boardsForUpdate.find(
          (b) => b.id === message.data.boardId
        );
        if (boardToUpdate) {
          const columnToUpdate = boardToUpdate.columns.find(
            (c) => c.id === message.data.columnId
          );
          if (columnToUpdate) {
            const cardIndex = columnToUpdate.cards.findIndex(
              (c) => c.id === message.data.card.id
            );
            if (cardIndex !== -1) {
              columnToUpdate.cards[cardIndex] = message.data.card;
              boardToUpdate.updatedAt = new Date().toISOString();
              await this.saveBoards(boardsForUpdate);
              this.sendMessage({
                command: "cardUpdated",
                data: {
                  success: true,
                  card: message.data.card,
                  columnId: message.data.columnId,
                },
              });
            } else {
              this.sendMessage({
                command: "cardUpdated",
                data: {
                  success: false,
                  error: "Card not found",
                },
              });
            }
          } else {
            this.sendMessage({
              command: "cardUpdated",
              data: {
                success: false,
                error: "Column not found",
              },
            });
          }
        } else {
          this.sendMessage({
            command: "cardUpdated",
            data: {
              success: false,
              error: "Board not found",
            },
          });
        }
        break;

      case "deleteCard":
        // Delete a card from a board's column and save to storage
        const boardsForDelete = this.getBoards();
        const boardForDelete = boardsForDelete.find(
          (b) => b.id === message.data.boardId
        );
        if (boardForDelete) {
          const columnForDelete = boardForDelete.columns.find(
            (c) => c.id === message.data.columnId
          );
          if (columnForDelete) {
            const cardIndex = columnForDelete.cards.findIndex(
              (c) => c.id === message.data.cardId
            );
            if (cardIndex !== -1) {
              columnForDelete.cards.splice(cardIndex, 1);
              boardForDelete.updatedAt = new Date().toISOString();
              await this.saveBoards(boardsForDelete);
              this.sendMessage({
                command: "cardDeleted",
                data: {
                  success: true,
                  cardId: message.data.cardId,
                  columnId: message.data.columnId,
                },
              });
            } else {
              this.sendMessage({
                command: "cardDeleted",
                data: {
                  success: false,
                  error: "Card not found",
                },
              });
            }
          } else {
            this.sendMessage({
              command: "cardDeleted",
              data: {
                success: false,
                error: "Column not found",
              },
            });
          }
        } else {
          this.sendMessage({
            command: "cardDeleted",
            data: {
              success: false,
              error: "Board not found",
            },
          });
        }
        break;

      case "moveCard":
        // Move a card from one column to another and save to storage
        const boardsForMove = this.getBoards();
        const boardForMove = boardsForMove.find(
          (b) => b.id === message.data.boardId
        );
        if (boardForMove) {
          const fromColumn = boardForMove.columns.find(
            (c) => c.id === message.data.fromColumnId
          );
          const toColumn = boardForMove.columns.find(
            (c) => c.id === message.data.toColumnId
          );

          if (fromColumn && toColumn) {
            const cardIndex = fromColumn.cards.findIndex(
              (c) => c.id === message.data.cardId
            );
            if (cardIndex !== -1) {
              const [card] = fromColumn.cards.splice(cardIndex, 1);
              toColumn.cards.push(card);
              boardForMove.updatedAt = new Date().toISOString();
              await this.saveBoards(boardsForMove);
              this.sendMessage({
                command: "cardMoved",
                data: {
                  success: true,
                  cardId: message.data.cardId,
                  fromColumnId: message.data.fromColumnId,
                  toColumnId: message.data.toColumnId,
                },
              });
            } else {
              this.sendMessage({
                command: "cardMoved",
                data: {
                  success: false,
                  error: "Card not found in source column",
                },
              });
            }
          } else {
            this.sendMessage({
              command: "cardMoved",
              data: {
                success: false,
                error: "Source or destination column not found",
              },
            });
          }
        } else {
          this.sendMessage({
            command: "cardMoved",
            data: {
              success: false,
              error: "Board not found",
            },
          });
        }
        break;

      case "openBoardInEditor":
        // Open a board in the editor
        const boardId = message.data.boardId;
        vscode.commands.executeCommand("boogie.openBoardInEditor", boardId);
        break;

      default:
        console.log(`Unknown command: ${message.command}`);
    }
  }

  public sendMessage(message: WebviewMessage): void {
    this.webview.postMessage(message);
  }
}
