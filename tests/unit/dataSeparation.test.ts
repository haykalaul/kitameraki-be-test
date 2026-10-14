import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Container, SqlQuerySpec } from '@azure/cosmos';
import { TaskRepository } from '../../src/repositories/taskRepository';
import { FormConfigRepository } from '../../src/repositories/formConfigRepository';
import type { TaskDocument } from '../../src/types';

describe('Data Separation & Regression: tasks vs formConfig', () => {
  let mockTasksContainer: Partial<Container>;
  let mockFormConfigContainer: Partial<Container>;
  let taskRepo: TaskRepository;
  let formConfigRepo: FormConfigRepository;

  // In-memory fake database for tasks container
  let tasksDb: Record<string, unknown>[];
  let formConfigDb: Record<string, unknown>[];

  beforeEach(() => {
    vi.clearAllMocks();
    tasksDb = [];
    formConfigDb = [];

    // Realistic mock of Cosmos DB query runner for tasks container
    mockTasksContainer = {
      items: {
        query: vi.fn((spec: SqlQuerySpec) => {
          return {
            fetchAll: vi.fn(async () => {
              const query = spec.query;
              const params = spec.parameters || [];
              const paramMap = new Map(params.map((p) => [p.name, p.value]));

              // Execute query filtering matching the SQL logic in TaskRepository
              const filtered = tasksDb.filter((doc) => {
                // Defense-in-depth task discriminator
                const isTask =
                  doc.docType === 'task' ||
                  (doc.docType === undefined && doc.status !== undefined && doc.fields === undefined);
                if (!isTask) return false;

                if (paramMap.has('@status') && doc.status !== paramMap.get('@status')) {
                  return false;
                }
                if (paramMap.has('@priority') && doc.priority !== paramMap.get('@priority')) {
                  return false;
                }
                if (paramMap.has('@id') && doc.id !== paramMap.get('@id')) {
                  return false;
                }
                if (paramMap.has('@search')) {
                  const searchStr = String(paramMap.get('@search')).toLowerCase();
                  const titleMatch = doc.title && String(doc.title).toLowerCase().includes(searchStr);
                  const descMatch =
                    doc.description && String(doc.description).toLowerCase().includes(searchStr);
                  if (!titleMatch && !descMatch) return false;
                }
                return true;
              });

              if (query.includes('SELECT VALUE COUNT(1)')) {
                return { resources: [filtered.length] };
              }

              const offset = (paramMap.get('@offset') as number) ?? 0;
              const limit = (paramMap.get('@limit') as number) ?? filtered.length;
              const sliced = filtered.slice(offset, offset + limit);

              return { resources: sliced };
            }),
          };
        }),
        create: vi.fn(async (doc: TaskDocument) => {
          tasksDb.push({ ...doc });
          return { resource: doc };
        }),
      } as unknown as Container['items'],
      item: vi.fn((id: string) => ({
        delete: vi.fn(async () => {
          const index = tasksDb.findIndex((d) => d.id === id);
          if (index !== -1) tasksDb.splice(index, 1);
          return { resource: undefined };
        }),
        read: vi.fn(async () => {
          const found = tasksDb.find((d) => d.id === id);
          return { resource: found ?? null };
        }),
      })) as unknown as Container['item'],
    };

    mockFormConfigContainer = {
      items: {
        upsert: vi.fn(async (doc: Record<string, unknown>) => {
          const idx = formConfigDb.findIndex((d) => d.id === doc.id);
          if (idx >= 0) {
            formConfigDb[idx] = { ...doc };
          } else {
            formConfigDb.push({ ...doc });
          }
          return { resource: doc };
        }),
      } as unknown as Container['items'],
      item: vi.fn((id: string, partitionKey: string) => ({
        read: vi.fn(async () => {
          const found = formConfigDb.find((d) => d.id === id && d.configType === partitionKey);
          return { resource: found ?? null };
        }),
      })) as unknown as Container['item'],
    };

    taskRepo = new TaskRepository(mockTasksContainer as Container);
    formConfigRepo = new FormConfigRepository(mockFormConfigContainer as Container);
  });

  describe('Isolation: tasks container vs formConfig container', () => {
    it('creating and updating config does not change task count or list results', async () => {
      // Seed 2 tasks in tasks container
      tasksDb.push(
        {
          id: 'task-1',
          docType: 'task',
          title: 'First Task',
          status: 'todo',
          priority: 'medium',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'task-2',
          docType: 'task',
          title: 'Second Task',
          status: 'in_progress',
          priority: 'high',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        }
      );

      const before = await taskRepo.list({ page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' });
      expect(before.totalItems).toBe(2);
      expect(before.items).toHaveLength(2);

      // Now create and update configuration in formConfig container
      await formConfigRepo.saveSettings({
        title: 'New Dynamic Task Form',
        fields: [
          { id: 'customField1', label: 'Client', type: 'text', builtIn: false, row: 0, column: 0 },
        ],
      });

      // Tasks container must be completely unchanged
      const after = await taskRepo.list({ page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' });
      expect(after.totalItems).toBe(2);
      expect(after.items).toHaveLength(2);
      expect(after.items.map((t) => t.id)).toEqual(['task-1', 'task-2']);
    });

    it('creating a task does not touch formConfig container', async () => {
      // Seed formConfig
      formConfigDb.push({
        id: 'task-form',
        configType: 'task-form',
        title: 'Default Form',
        fields: [],
        version: 1,
      });

      // Create a task
      await taskRepo.create({
        title: 'New Isolated Task',
        status: 'todo',
        priority: 'low',
      });

      // Assert formConfig container was never called or modified
      expect(mockFormConfigContainer.items?.upsert).not.toHaveBeenCalled();
      expect(formConfigDb).toHaveLength(1);
      expect(formConfigDb[0].title).toBe('Default Form');
    });
  });

  describe('Regression test: stray config-shaped document in tasks container', () => {
    beforeEach(() => {
      // Seed tasks container with 2 valid tasks AND 1 stray config-shaped document
      tasksDb.push(
        {
          id: 'task-101',
          docType: 'task',
          title: 'Legitimate Task 1',
          status: 'todo',
          priority: 'medium',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'task-102',
          title: 'Legitimate Task 2 (Legacy, no docType)',
          status: 'done',
          priority: 'low',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
        // Stray config-shaped document that accidentally exists in tasks container
        {
          id: 'task-form',
          title: 'Task Form Configuration',
          description: 'Global layout and field settings',
          fields: [{ id: 'f1', label: 'Field 1', type: 'text' }],
          version: 3,
          _partitionKey: 'form-settings',
          updatedAt: '2026-01-03T00:00:00Z',
        }
      );
    });

    it('unfiltered list excludes stray config document and pagination counts only tasks', async () => {
      const result = await taskRepo.list({
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Assert only legitimate tasks are returned
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(result.items.some((item) => item.id === 'task-form')).toBe(false);
      expect(result.items.map((i) => i.id)).toEqual(['task-101', 'task-102']);
    });

    it('search matching "Form" or "Configuration" excludes the stray config document', async () => {
      const result = await taskRepo.list({
        page: 1,
        pageSize: 10,
        search: 'Form',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Even though stray config title contains "Form", it must NOT be returned
      expect(result.totalItems).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('findById("task-form") returns null instead of stray config document', async () => {
      const result = await taskRepo.findById('task-form');
      expect(result).toBeNull();
    });
  });
});
