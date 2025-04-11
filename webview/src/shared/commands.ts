/**
 * Shared command constants for Boogie
 *
 * This file contains all the command names used for communication between
 * the extension backend and the webview frontend.
 */

export const Commands = {
  // Board commands
  GET_BOARDS: "getBoards",
  GET_BOARD: "getBoard",
  CREATE_BOARD: "createBoard",
  DELETE_BOARD: "deleteBoard",
  UPDATE_BOARD: "updateBoard",
  OPEN_BOARD: "openBoard",
  OPEN_BOARD_IN_EDITOR: "openBoardInEditor",

  // Column commands
  ADD_COLUMN: "addColumn",
  UPDATE_COLUMN: "updateColumn",
  DELETE_COLUMN: "deleteColumn",

  // Card commands
  ADD_CARD: "addCard",
  UPDATE_CARD: "updateCard",
  DELETE_CARD: "deleteCard",
  MOVE_CARD: "moveCard",

  // Response commands
  BOARDS_LOADED: "boardsLoaded",
  BOARD_LOADED: "boardLoaded",
  BOARD_CREATED: "boardCreated",
  BOARD_DELETED: "boardDeleted",
  BOARD_UPDATED: "boardUpdated",
  BOARD_OPENED: "boardOpened",
  BOARD_OPENED_IN_EDITOR: "boardOpenedInEditor",

  COLUMN_ADDED: "columnAdded",
  COLUMN_UPDATED: "columnUpdated",
  COLUMN_DELETED: "columnDeleted",

  CARD_ADDED: "cardAdded",
  CARD_UPDATED: "cardUpdated",
  CARD_DELETED: "cardDeleted",
  CARD_MOVED: "cardMoved",

  // Utility commands
  LOG: "log",
  ERROR: "error",
  SHOW_ERROR_MESSAGE: "showErrorMessage",
};

/**
 * Type for commands to enforce using only defined command strings
 */
export type CommandType = (typeof Commands)[keyof typeof Commands];
