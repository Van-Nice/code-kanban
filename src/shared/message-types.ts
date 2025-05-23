import { CommandType, Commands } from "./commands";
import { Board, Column } from "../models/board";
import { Card as SharedCard } from "./types";

/**
 * Base interface for all webview messages
 */
export interface WebviewMessageBase {
  command: CommandType;
  data?: Record<string, any>;
}

/**
 * Base interface for all response messages
 */
export interface ResponseMessageBase {
  command: CommandType;
  data: {
    success: boolean;
    error?: string;
  };
}

/**
 * Message sent when a column is added
 */
export interface AddColumnMessage extends WebviewMessageBase {
  command: typeof Commands.ADD_COLUMN;
  data: {
    boardId: string;
    columnId?: string;
    title: string;
  };
}

/**
 * Response when a column is added
 */
export interface ColumnAddedResponse extends ResponseMessageBase {
  command: typeof Commands.COLUMN_ADDED;
  data: {
    success: boolean;
    column?: Column;
    boardId: string;
    error?: string;
  };
}

/**
 * Message sent when a column is updated
 */
export interface UpdateColumnMessage extends WebviewMessageBase {
  command: typeof Commands.UPDATE_COLUMN;
  data: {
    boardId: string;
    columnId: string;
    title: string;
  };
}

/**
 * Response when a column is updated
 */
export interface ColumnUpdatedResponse extends ResponseMessageBase {
  command: typeof Commands.COLUMN_UPDATED;
  data: {
    success: boolean;
    column?: Column;
    boardId: string;
    error?: string;
  };
}

/**
 * Message sent when a column is deleted
 */
export interface DeleteColumnMessage extends WebviewMessageBase {
  command: typeof Commands.DELETE_COLUMN;
  data: {
    boardId: string;
    columnId: string;
  };
}

/**
 * Response when a column is deleted
 */
export interface ColumnDeletedResponse extends ResponseMessageBase {
  command: typeof Commands.COLUMN_DELETED;
  data: {
    success: boolean;
    columnId?: string;
    boardId?: string;
    error?: string;
  };
}

/**
 * Generic column response that can be used for both add and update operations
 */
export interface ColumnResponse extends ResponseMessageBase {
  command: typeof Commands.COLUMN_ADDED | typeof Commands.COLUMN_UPDATED;
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

// represents column collapse state message
export interface SetColumnCollapseStateMessage extends WebviewMessageBase {
  command: typeof Commands.SET_COLUMN_COLLAPSED_STATE;
  data: {
    boardId: string;
    columnId: string;
    collapsed: boolean;
  };
}

/**
 * Message sent when opening a board in editor
 */
export interface OpenBoardInEditorMessage extends WebviewMessageBase {
  command: typeof Commands.OPEN_BOARD_IN_EDITOR;
  data: {
    boardId: string;
  };
}

/**
 * Response when a board is opened in editor
 */
export interface OpenBoardInEditorResponse extends ResponseMessageBase {
  command: typeof Commands.BOARD_OPENED_IN_EDITOR;
  data: {
    success: boolean;
    error?: string;
  };
}

/**
 * Message sent when adding a card
 */
export interface AddCardMessage extends WebviewMessageBase {
  command: typeof Commands.ADD_CARD;
  data: {
    boardId: string;
    columnId: string;
    cardId?: string;
    title: string;
    description?: string;
    tags?: string[];
  };
}

/**
 * Response when a card is added
 */
export interface CardAddedResponse extends ResponseMessageBase {
  command: typeof Commands.CARD_ADDED;
  data: {
    success: boolean;
    boardId: string;
    columnId: string;
    card?: SharedCard;
    error?: string;
  };
}

/**
 * Message sent when updating a card
 */
export interface UpdateCardMessage extends WebviewMessageBase {
  command: typeof Commands.UPDATE_CARD;
  data: {
    boardId: string;
    columnId: string;
    cardId: string;
    title?: string;
    description?: string;
    tags?: string[];
    order?: number;
  };
}
