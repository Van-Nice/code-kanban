export interface Card {
  id: string;
  title: string;
  description: string;
  labels: string[];
  assignee: string;
  columnId: string;
  boardId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}
