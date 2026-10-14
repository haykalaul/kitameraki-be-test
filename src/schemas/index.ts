import { z } from 'zod';

const emptyToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const taskStatusEnum = z.enum(['todo', 'in_progress', 'done']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high']);

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.preprocess(
    emptyToUndefined,
    z.string().max(2000, 'Description must be at most 2000 characters').optional()
  ),
  status: taskStatusEnum,
  priority: z.preprocess(emptyToUndefined, taskPriorityEnum.default('medium')),
  dueDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'dueDate must be an ISO date string')
      .optional()
  ),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .optional(),
  description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  status: z.preprocess(emptyToUndefined, taskStatusEnum.optional()),
  priority: z.preprocess(emptyToUndefined, taskPriorityEnum.optional()),
  dueDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'dueDate must be an ISO date string')
      .optional()
  ),
});

export const updateStatusSchema = z.object({
  status: taskStatusEnum,
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  status: z.preprocess(emptyToUndefined, taskStatusEnum.optional()),
  priority: z.preprocess(emptyToUndefined, taskPriorityEnum.optional()),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'title', 'dueDate', 'priority'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
