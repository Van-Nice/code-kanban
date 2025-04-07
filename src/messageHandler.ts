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

// In-memory storage for boards (in a real extension, this would be persisted)
let boards: Board[] = [];

export class MessageHandler {
  private webview: vscode.Webview;

  constructor(webview: vscode.Webview) {
    this.webview = webview;
  }

  public handleMessage(message: WebviewMessage): void {
    console.log("Received message from webview:", message);

    switch (message.command) {
      case "getBoards":
        // Return all boards
        this.sendMessage({
          command: "boardsLoaded",
          data: { boards },
        });
        break;

      case "getBoard":
        // Return a specific board
        const board = boards.find((b) => b.id === message.data.boardId);
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
        // Create a new board
        const newBoard: Board = {
          ...message.data,
          columns: [
            { id: "todo", title: "To Do", cards: [] },
            { id: "in-progress", title: "In Progress", cards: [] },
            { id: "done", title: "Done", cards: [] },
          ],
        };
        boards.push(newBoard);
        this.sendMessage({
          command: "boardCreated",
          data: {
            success: true,
            board: newBoard,
          },
        });
        break;

      case "deleteBoard":
        // Delete a board
        const boardIndex = boards.findIndex(
          (b) => b.id === message.data.boardId
        );
        if (boardIndex !== -1) {
          boards.splice(boardIndex, 1);
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
        // Add a card to a board's column
        const targetBoard = boards.find((b) => b.id === message.data.boardId);
        if (targetBoard) {
          const column = targetBoard.columns.find(
            (c) => c.id === message.data.columnId
          );
          if (column) {
            column.cards.push(message.data.card);
            targetBoard.updatedAt = new Date().toISOString();
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
        // Update a card in a board's column
        const boardToUpdate = boards.find((b) => b.id === message.data.boardId);
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
        // Delete a card from a board's column
        const boardForDelete = boards.find(
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
        // Move a card from one column to another
        const boardForMove = boards.find((b) => b.id === message.data.boardId);
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

      default:
        console.log(`Unknown command: ${message.command}`);
    }
  }

  public sendMessage(message: WebviewMessage): void {
    this.webview.postMessage(message);
  }
}
