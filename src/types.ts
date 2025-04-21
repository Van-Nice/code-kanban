export interface Board {
  id: string;
  title: string;
  description: string;
  columns: Column[];
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  title: string;
  cards: Card[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  tags: string[];
  columnId: string;
  boardId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}
