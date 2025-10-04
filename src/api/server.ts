import * as vscode from "vscode";
import express, { Request, Response } from "express";
import { BoardStorage } from "../handlers/board/board-storage";
import { Server } from "http";
import { convertToApiBoard } from "../models/adapters";

let server: Server | null = null;

export function startServer(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("codeKanban.api");
  const apiEnabled = config.get("enabled", false);
  const port = config.get("port", 3000);

  console.log(`Code Kanban API Config: enabled=${apiEnabled}, port=${port}`);

  if (!apiEnabled) {
    console.log("Code Kanban API is disabled by configuration.");
    return;
  }

  const boardStorage = new BoardStorage(context);
  const app = express();

  app.get("/boards", async (req: Request, res: Response) => {
    try {
      const boards = await boardStorage.getBoards();
      const apiBoards = boards.map(convertToApiBoard);
      res.json(apiBoards);
    } catch (error) {
      res.status(500).send("Error fetching boards");
    }
  });

  app.get("/boards/:boardId", async (req: Request, res: Response) => {
    try {
      const board = await boardStorage.getBoard(req.params.boardId);
      if (board) {
        const apiBoard = convertToApiBoard(board);
        res.json(apiBoard);
      } else {
        res.status(404).send("Board not found");
      }
    } catch (error) {
      res.status(500).send("Error fetching board");
    }
  });

  server = app.listen(port, () => {
    console.log(`Code Kanban API server listening on port ${port}`);
  });
}

export function stopServer() {
  if (server) {
    server.close(() => {
      console.log("Code Kanban API server stopped");
    });
  }
}
