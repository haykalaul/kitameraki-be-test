function sanitizeCustomFields(
  fields?: Record<string, string | null | undefined>
): Record<string, string | null> {
  if (!fields) return {};
  const result: Record<string, string | null> = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = val === undefined ? null : val;
  }
  return result;
}

import { Container, SqlQuerySpec, SqlParameter } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskDocument, PaginatedResult } from '../types';
import type { CreateTaskInput, UpdateTaskInput, ListQueryInput } from '../schemas';

/**
 * Repository layer — all Cosmos DB I/O lives here.
 * Uses parameterized queries only; never string-concatenates user input.
 */
export class TaskRepository {
  constructor(private readonly container: Container) {}

  async list(query: ListQueryInput): Promise<PaginatedResult<Task>> {
    const { page, pageSize, status, priority, search, sortBy, sortOrder } = query;
    const offset = (page - 1) * pageSize;

    // Build WHERE clauses with parameters — no string interpolation of user data
    // Defense-in-depth: only match documents that are tasks (excludes stray config docs)
    const conditions: string[] = [
      '(c.docType = @taskDocType OR (NOT IS_DEFINED(c.docType) AND IS_DEFINED(c.status) AND NOT IS_DEFINED(c.fields)))',
    ];
    const parameters: SqlParameter[] = [{ name: '@taskDocType', value: 'task' }];

    if (status) {
      conditions.push('c.status = @status');
      parameters.push({ name: '@status', value: status });
    }
    if (priority) {
      conditions.push('c.priority = @priority');
      parameters.push({ name: '@priority', value: priority });
    }
    if (search) {
      conditions.push(
        '(CONTAINS(LOWER(c.title), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)))'
      );
      parameters.push({ name: '@search', value: search });
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const orderClause = `ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}`;

    // Count query
    const countSpec: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c ${whereClause}`,
      parameters,
    };
    const { resources: countResult } = await this.container.items
      .query<number>(countSpec)
      .fetchAll();
    const totalItems = countResult[0] ?? 0;

    // Data query with pagination using OFFSET + LIMIT
    const dataSpec: SqlQuerySpec = {
      query: `SELECT * FROM c ${whereClause} ${orderClause} OFFSET @offset LIMIT @limit`,
      parameters: [
        ...parameters,
        { name: '@offset', value: offset },
        { name: '@limit', value: pageSize },
      ],
    };
    const { resources: items } = await this.container.items
      .query<TaskDocument>(dataSpec)
      .fetchAll();

    return {
      items: items.map(toTask),
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  async findById(id: string): Promise<Task | null> {
    const doc = await this.findDocumentById(id);
    return doc ? toTask(doc) : null;
  }

  private async findDocumentById(id: string): Promise<TaskDocument | null> {
    const spec: SqlQuerySpec = {
      query:
        'SELECT * FROM c WHERE c.id = @id AND (c.docType = "task" OR (NOT IS_DEFINED(c.docType) AND IS_DEFINED(c.status) AND NOT IS_DEFINED(c.fields)))',
      parameters: [{ name: '@id', value: id }],
    };
    const { resources } = await this.container.items.query<TaskDocument>(spec).fetchAll();
    return resources[0] ?? null;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const doc: TaskDocument = {
      id: uuidv4(),
      docType: 'task',
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate,
      customFields: sanitizeCustomFields(input.customFields),
      createdAt: now,
      updatedAt: now,
      _partitionKey: input.status,
    };
    const { resource } = await this.container.items.create<TaskDocument>(doc);
    if (!resource) throw new Error('Failed to create task: no resource returned');
    return toTask(resource);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const existingDoc = await this.findDocumentById(id);
    if (!existingDoc) return null;

    const newStatus = input.status ?? existingDoc.status;
    const oldPartitionKey = existingDoc._partitionKey || existingDoc.status;
    const now = new Date().toISOString();

    const updatedDoc: TaskDocument = {
      id: existingDoc.id,
      docType: 'task',
      title: input.title !== undefined ? input.title : existingDoc.title,
      description: input.description !== undefined ? input.description : existingDoc.description,
      status: newStatus,
      priority: input.priority !== undefined ? input.priority : existingDoc.priority,
      dueDate: input.dueDate !== undefined ? input.dueDate : existingDoc.dueDate,
      customFields: input.customFields !== undefined
        ? sanitizeCustomFields({ ...(existingDoc.customFields ?? {}), ...input.customFields })
        : existingDoc.customFields,
      createdAt: existingDoc.createdAt,
      updatedAt: now,
      _partitionKey: newStatus,
    };

    if (newStatus !== existingDoc.status) {
      // In Cosmos DB, partition keys are immutable.
      // Changing the partition key requires deleting the old document and inserting the updated document into the new partition.
      await this.container.item(id, oldPartitionKey).delete();
      const { resource } = await this.container.items.create<TaskDocument>(updatedDoc);
      if (!resource) throw new Error('Failed to create updated task in new partition');
      return toTask(resource);
    } else {
      const { resource } = await this.container
        .item(id, oldPartitionKey)
        .replace<TaskDocument>(updatedDoc);
      if (!resource) throw new Error('Failed to update task: no resource returned');
      return toTask(resource);
    }
  }

  async delete(id: string): Promise<boolean> {
    const existingDoc = await this.findDocumentById(id);
    if (!existingDoc) return false;
    const partitionKey = existingDoc._partitionKey || existingDoc.status;
    await this.container.item(id, partitionKey).delete();
    return true;
  }
}

function toTask(doc: TaskDocument): Task {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    priority: doc.priority,
    dueDate: doc.dueDate,
    customFields: doc.customFields ?? {},
    docType: doc.docType ?? 'task',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
