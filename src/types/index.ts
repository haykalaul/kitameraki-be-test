export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // ISO date string
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** Shape stored in Cosmos DB (partition key = status) */
export interface TaskDocument extends Task {
  _partitionKey: string; // mirrors status; allows efficient queries per status
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface FetchTasksQuery {
  page: number;
  pageSize: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'dueDate' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}
