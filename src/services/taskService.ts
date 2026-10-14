import { z } from 'zod';
import type { Task, PaginatedResult, FormSettings, FormField } from '../types';
import type { TaskRepository } from '../repositories/taskRepository';
import type { FormSettingsRepository } from '../repositories/formSettingsRepository';
import type { CreateTaskInput, UpdateTaskInput, ListQueryInput } from '../schemas';

export class CustomFieldValidationError extends Error {
  constructor(public readonly details: { field: string; message: string }[]) {
    super('Custom field validation failed');
    this.name = 'CustomFieldValidationError';
  }
}

export function validateTaskCustomFields(
  customFields: Record<string, string | null | undefined> | undefined,
  settings: FormSettings,
  isPartialUpdate = false
): void {
  const issues: { field: string; message: string }[] = [];
  const activeCustomFields = settings.fields.filter((f) => !f.builtIn);
  const activeCustomFieldMap = new Map<string, FormField>(
    activeCustomFields.map((f) => [f.id, f])
  );

  // 1. Check for unknown keys
  if (customFields) {
    for (const key of Object.keys(customFields)) {
      if (!activeCustomFieldMap.has(key)) {
        issues.push({ field: key, message: `Unknown custom field: "${key}"` });
      }
    }
  }

  // 2. Validate each active custom field
  for (const field of activeCustomFields) {
    const value = customFields ? customFields[field.id] : undefined;

    if (field.required) {
      if (!isPartialUpdate && (value === undefined || value === null || value === '')) {
        issues.push({ field: field.id, message: `Field "${field.label}" is required` });
        continue;
      }
      if (isPartialUpdate && value !== undefined && (value === null || value === '')) {
        issues.push({ field: field.id, message: `Field "${field.label}" cannot be empty` });
        continue;
      }
    }

    if (value !== undefined && value !== null && value !== '') {
      switch (field.type) {
        case 'text':
          if (typeof value !== 'string' || value.length > 1000) {
            issues.push({
              field: field.id,
              message: `Field "${field.label}" must be a text string up to 1000 characters`,
            });
          }
          break;
        case 'email':
          if (!z.string().email().safeParse(value).success) {
            issues.push({
              field: field.id,
              message: `Field "${field.label}" must be a valid email address`,
            });
          }
          break;
        case 'date':
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value))) {
            issues.push({
              field: field.id,
              message: `Field "${field.label}" must be a valid date in YYYY-MM-DD format`,
            });
          }
          break;
        case 'datetime':
          if (isNaN(Date.parse(value))) {
            issues.push({
              field: field.id,
              message: `Field "${field.label}" must be a valid ISO 8601 datetime`,
            });
          }
          break;
      }
    }
  }

  if (issues.length > 0) {
    throw new CustomFieldValidationError(issues);
  }
}

/**
 * Service layer — business logic and validation decisions.
 */
export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly formSettingsRepo?: FormSettingsRepository
  ) {}

  async listTasks(query: ListQueryInput): Promise<PaginatedResult<Task>> {
    return this.repo.list(query);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.repo.findById(id);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    if (this.formSettingsRepo) {
      const settings = await this.formSettingsRepo.getSettings();
      validateTaskCustomFields(input.customFields, settings, false);
    }
    return this.repo.create(input);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
    if (this.formSettingsRepo && input.customFields !== undefined) {
      const settings = await this.formSettingsRepo.getSettings();
      validateTaskCustomFields(input.customFields, settings, true);
    }
    return this.repo.update(id, input);
  }

  async updateStatus(id: string, status: Task['status']): Promise<Task | null> {
    return this.repo.update(id, { status });
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}
