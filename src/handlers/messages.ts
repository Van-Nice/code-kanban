import { Board, Column, Card } from "../models/board";

export interface WebviewMessageBase {
  command: string;
}

export interface LogMessage extends WebviewMessageBase {
  command: "log";
  data: { message: string; data?: any };
}

export interface ErrorMessage extends WebviewMessageBase {
  command: "error";
  data: { message: string; error?: any };
}

export interface GetBoardsMessage extends WebviewMessageBase {
  command: "getBoards";
  data?: {}; // Make data optional/empty object
}

export interface GetBoardMessage extends WebviewMessageBase {
  command: "getBoard";
  data: { boardId: string };
}

export interface CreateBoardMessage extends WebviewMessageBase {
  command: "createBoard";
  data: {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface DeleteBoardMessage extends WebviewMessageBase {
  command: "deleteBoard";
  data: { boardId: string };
}

export interface AddCardMessage extends WebviewMessageBase {
  command: "addCard";
  data: {
    boardId: string;
    columnId: string;
    cardId?: string;
    title: string;
    description: string;
  };
}

export interface UpdateCardMessage extends WebviewMessageBase {
  command: "updateCard";
  data: {
    boardId: string;
    columnId: string;
    cardId: string;
    title: string;
    description: string;
  };
}

export interface DeleteCardMessage extends WebviewMessageBase {
  command: "deleteCard";
  data: {
    boardId: string;
    columnId: string;
    cardId: string;
  };
}

export interface MoveCardMessage extends WebviewMessageBase {
  command: "moveCard";
  data: {
    boardId: string;
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    position?: number; // Optional position in target column
  };
}

export interface OpenBoardInEditorMessage extends WebviewMessageBase {
  command: "openBoardInEditor";
  data: { boardId: string };
}

export interface ShowErrorMessageMessage extends WebviewMessageBase {
  command: "showErrorMessage";
  data: { message: string };
}

export interface AddColumnMessage extends WebviewMessageBase {
  command: "addColumn";
  data: {
    boardId: string;
    columnId?: string;
    title: string;
  };
}

export interface UpdateColumnMessage extends WebviewMessageBase {
  command: "updateColumn";
  data: {
    boardId: string;
    columnId: string;
    title: string;
  };
}

export interface DeleteColumnMessage extends WebviewMessageBase {
  command: "deleteColumn";
  data: {
    boardId: string;
    columnId: string;
  };
}

export interface UpdateBoardMessage extends WebviewMessageBase {
  command: "updateBoard";
  data: {
    boardId: string;
    title: string;
  };
}

export interface BoardUpdatedResponse {
  command: "boardUpdated";
  data: {
    success: boolean;
    board?: Board;
    error?: string;
  };
}

export type WebviewMessage =
  | LogMessage
  | ErrorMessage
  | GetBoardsMessage
  | GetBoardMessage
  | CreateBoardMessage
  | DeleteBoardMessage
  | UpdateBoardMessage
  | AddCardMessage
  | UpdateCardMessage
  | DeleteCardMessage
  | MoveCardMessage
  | AddColumnMessage
  | UpdateColumnMessage
  | DeleteColumnMessage
  | OpenBoardInEditorMessage
  | ShowErrorMessageMessage
  | WebviewMessageBase;

export interface ResponseMessageBase {
  command: string;
  data: {
    success: boolean;
    error?: string;
  };
}

export interface BoardsLoadedResponse extends ResponseMessageBase {
  command: "boardsLoaded";
  data: {
    success: boolean;
    boards: Board[];
    error?: string;
  };
}

export interface BoardLoadedResponse extends ResponseMessageBase {
  command: "boardLoaded";
  data: {
    success: boolean;
    columns?: Column[];
    title?: string;
    context?: string;
    updatedAt?: string;
    error?: string;
  };
}

export interface BoardCreatedResponse extends ResponseMessageBase {
  command: "boardCreated";
  data: {
    success: boolean;
    board?: Board;
    error?: string;
  };
}

export interface BoardDeletedResponse extends ResponseMessageBase {
  command: "boardDeleted";
  data: {
    success: boolean;
    error?: string;
    boardId?: string;
  };
}

export interface BoardResponse extends ResponseMessageBase {
  command: "boardUpdated";
  data: {
    success: boolean;
    error?: string;
    board?: Board;
  };
}

export interface CardResponse extends ResponseMessageBase {
  command: "cardAdded" | "cardUpdated";
  data: {
    success: boolean;
    card?: Card;
    columnId?: string;
    error?: string;
  };
}

export interface CardDeletedResponse extends ResponseMessageBase {
  command: "cardDeleted";
  data: {
    success: boolean;
    boardId?: string;
    columnId?: string;
    cardId?: string;
    error?: string;
  };
}

export interface CardMovedResponse extends ResponseMessageBase {
  command: "cardMoved";
  data: {
    success: boolean;
    boardId: string;
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    error?: string;
  };
}

export interface ColumnResponse extends ResponseMessageBase {
  command: "columnUpdated" | "columnAdded";
  data: {
    success: boolean;
    column?: Column;
    boardId?: string;
    error?: string;
    oldTitle?: string;
    newTitle?: string;
    updatedAt?: string;
  };
}

export interface ColumnDeletedResponse extends ResponseMessageBase {
  command: "columnDeleted";
  data: {
    success: boolean;
    columnId?: string;
    boardId?: string;
    error?: string;
  };
}

export type ResponseMessage =
  | BoardsLoadedResponse
  | BoardLoadedResponse
  | BoardCreatedResponse
  | BoardDeletedResponse
  | BoardResponse
  | CardResponse
  | CardDeletedResponse
  | CardMovedResponse
  | ColumnResponse
  | ColumnDeletedResponse
  | ResponseMessageBase;

export interface WebviewResponse {
  command: string;
  data: any;
}

export interface BoardAddedResponse {
  command: "boardAdded";
  data: {
    success: boolean;
    board?: Board;
    error?: string;
  };
}

export interface ColumnAddedResponse {
  command: "columnAdded";
  data: {
    success: boolean;
    boardId: string;
    column?: Column;
    error?: string;
  };
}

export interface ColumnUpdatedResponse {
  command: "columnUpdated";
  data: {
    success: boolean;
    boardId: string;
    column?: Column;
    error?: string;
  };
}

export interface CardAddedResponse {
  command: "cardAdded";
  data: {
    success: boolean;
    boardId: string;
    columnId: string;
    card?: Card;
    error?: string;
  };
}

export interface CardUpdatedResponse {
  command: "cardUpdated";
  data: {
    success: boolean;
    boardId: string;
    columnId: string;
    card?: Card;
    error?: string;
  };
}

export interface OpenBoardMessage extends WebviewMessageBase {
  command: "openBoard";
  data: {
    boardId: string;
  };
}

export interface BoardOpenedResponse {
  command: "boardOpened";
  data: {
    success: boolean;
    board?: Board;
    error?: string;
  };
}

export interface BoardsRetrievedResponse {
  command: "boardsRetrieved";
  data: {
    success: boolean;
    boards?: Board[];
    error?: string;
  };
}

export interface BoardLoadedMessage extends WebviewMessageBase {
  command: "boardLoaded";
  data: {
    success: boolean;
    columns: any[];
    title: string;
    context: string;
    updatedAt: string;
  };
}
