export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export type FieldType = 'text' | 'date' | 'datetime' | 'email';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  builtIn: boolean;
  row: number;
  column: 0 | 1;
}

export interface FormSettings {
  id: 'task-form';
  title: string;
  description?: string;
  fields: FormField[];
  version: number;
  updatedAt: string;
  _etag?: string;
}

export interface FormSettingsDocument extends FormSettings {
  configType: string; // partition key for formConfig container (/configType)
  _partitionKey?: string; // legacy partition key for backwards/migration compatibility
}

export const DEFAULT_FORM_FIELDS: FormField[] = [
  { id: 'title', label: 'Title', type: 'text', required: true, builtIn: true, row: 0, column: 0 },
  { id: 'description', label: 'Description', type: 'text', required: false, builtIn: true, row: 1, column: 0 },
  { id: 'status', label: 'Status', type: 'text', required: true, builtIn: true, row: 2, column: 0 },
  { id: 'priority', label: 'Priority', type: 'text', required: false, builtIn: true, row: 2, column: 1 },
  { id: 'dueDate', label: 'Due Date', type: 'date', required: false, builtIn: true, row: 3, column: 0 },
];

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  id: 'task-form',
  title: 'Task Management Form',
  description: 'Default task form layout and custom fields configuration',
  fields: DEFAULT_FORM_FIELDS,
  version: 1,
  updatedAt: new Date(0).toISOString(),
};

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // ISO date string
  customFields?: Record<string, string | null>;
  docType?: 'task';
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** Shape stored in Cosmos DB (partition key = status) */
export interface TaskDocument extends Task {
  _partitionKey: string; // mirrors status; allows efficient queries per status
  docType?: 'task';
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
  customFields?: Record<string, string | null>;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  customFields?: Record<string, string | null>;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}
