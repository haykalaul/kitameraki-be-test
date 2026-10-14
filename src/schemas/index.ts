import { z } from 'zod';

const taskStatusEnum = z.enum(['todo', 'in_progress', 'done']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high']);

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().max(2000, 'Description must be at most 2000 characters').optional(),
  status: taskStatusEnum,
  priority: taskPriorityEnum.default('medium'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'dueDate must be an ISO date string')
    .optional(),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .optional(),
  description: z.string().max(2000).optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'dueDate must be an ISO date string')
    .optional(),
});

export const updateStatusSchema = z.object({
  status: taskStatusEnum,
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  search: z.string().max(200).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'title', 'dueDate', 'priority'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
