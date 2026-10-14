import type { Task, PaginatedResult } from '../types';
import type { TaskRepository } from '../repositories/taskRepository';
import type { CreateTaskInput, UpdateTaskInput, ListQueryInput } from '../schemas';

/**
 * Service layer — business logic and error-level decisions.
 * Calls only the repository; never touches HTTP or Cosmos directly.
 */
export class TaskService {
  constructor(private readonly repo: TaskRepository) {}

  async listTasks(query: ListQueryInput): Promise<PaginatedResult<Task>> {
    return this.repo.list(query);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.repo.findById(id);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.repo.create(input);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
    return this.repo.update(id, input);
  }

  async updateStatus(id: string, status: Task['status']): Promise<Task | null> {
    return this.repo.update(id, { status });
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}
