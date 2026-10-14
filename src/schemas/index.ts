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
  customFields: z.record(z.string(), z.string().nullable().optional()).optional(),
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
  customFields: z.record(z.string(), z.string().nullable().optional()).optional(),
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

// Form Settings Schemas
export const formFieldTypeEnum = z.enum(['text', 'date', 'datetime', 'email']);

export const formFieldSchema = z.object({
  id: z.string().min(1, 'Field id is required'),
  label: z.string().min(1, 'Field label is required').max(100, 'Field label must be at most 100 characters'),
  type: formFieldTypeEnum,
  description: z.string().max(500).optional(),
  required: z.boolean().optional().default(false),
  builtIn: z.boolean().optional().default(false),
  row: z.number().int().min(0, 'Row must be non-negative'),
  column: z.union([z.literal(0), z.literal(1)]),
});

export const updateFormSettingsSchema = z.object({
  title: z.string().min(1, 'Form title is required').max(200),
  description: z.string().max(1000).optional(),
  fields: z.array(formFieldSchema).superRefine((fields, ctx) => {
    const ids = new Set<string>();
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (ids.has(field.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field ID: "${field.id}"`,
          path: [i, 'id'],
        });
      }
      ids.add(field.id);
    }

    const rowSlots = new Map<number, Set<number>>();
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      let cols = rowSlots.get(field.row);
      if (!cols) {
        cols = new Set<number>();
        rowSlots.set(field.row, cols);
      }
      if (cols.has(field.column)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Slot row ${field.row}, column ${field.column} is occupied by multiple fields`,
          path: [i, 'column'],
        });
      }
      cols.add(field.column);
      if (cols.size > 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Row ${field.row} exceeds maximum of 2 columns`,
          path: [i, 'row'],
        });
      }
    }
  }),
  version: z.number().int().positive().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
export type FormFieldInput = z.infer<typeof formFieldSchema>;
export type UpdateFormSettingsInput = z.infer<typeof updateFormSettingsSchema>;
