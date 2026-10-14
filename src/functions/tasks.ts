import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ZodError } from 'zod';
import { getContainer } from '../db/cosmosClient';
import { TaskRepository } from '../repositories/taskRepository';
import { TaskService } from '../services/taskService';
import {
  createTaskSchema,
  updateTaskSchema,
  updateStatusSchema,
  listQuerySchema,
} from '../schemas';
import {
  ok,
  created,
  noContent,
  notFound,
  validationError,
  internalError,
  serviceUnavailable,
  parseBody,
} from '../middleware/response';

// ---------------------------------------------------------------------------
// Shared factory — builds service from a fresh container per cold start
// ---------------------------------------------------------------------------
async function getService(): Promise<TaskService> {
  const container = await getContainer();
  const repo = new TaskRepository(container);
  return new TaskService(repo);
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
async function healthCheck(_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  ctx.log("healthCheck called");
  try {
    const container = await getContainer();
    const { resource } = await container.read();
    return ok({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: "task-management-api",
      database: {
        status: "connected",
        container: resource?.id,
      },
    });
  } catch (err) {
    ctx.error("Health check failed", err);
    return serviceUnavailable("Database connection failed", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// GET /api/tasks
// ---------------------------------------------------------------------------
async function listTasks(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  ctx.log('listTasks called');
  try {
    const rawQuery = Object.fromEntries(req.query.entries());
    const parseResult = listQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) return validationError(parseResult.error as ZodError);

    const service = await getService();
    const result = await service.listTasks(parseResult.data);
    return ok(result);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/tasks/{id}
// ---------------------------------------------------------------------------
async function getTask(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const id = req.params['id'];
  ctx.log('getTask called', { id });
  try {
    const service = await getService();
    const task = await service.getTask(id);
    return task ? ok(task) : notFound(`Task ${id} not found`);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/tasks
// ---------------------------------------------------------------------------
async function createTask(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  ctx.log('createTask called');
  try {
    const body = await parseBody(req);
    const parseResult = createTaskSchema.safeParse(body);
    if (!parseResult.success) return validationError(parseResult.error as ZodError);

    const service = await getService();
    const task = await service.createTask(parseResult.data);
    return created(task);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/tasks/{id}
// ---------------------------------------------------------------------------
async function updateTask(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const id = req.params['id'];
  ctx.log('updateTask called', { id });
  try {
    const body = await parseBody(req);
    const parseResult = updateTaskSchema.safeParse(body);
    if (!parseResult.success) return validationError(parseResult.error as ZodError);

    const service = await getService();
    const task = await service.updateTask(id, parseResult.data);
    return task ? ok(task) : notFound(`Task ${id} not found`);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/tasks/{id}/status
// ---------------------------------------------------------------------------
async function updateTaskStatus(
  req: HttpRequest,
  ctx: InvocationContext
): Promise<HttpResponseInit> {
  const id = req.params['id'];
  ctx.log('updateTaskStatus called', { id });
  try {
    const body = await parseBody(req);
    const parseResult = updateStatusSchema.safeParse(body);
    if (!parseResult.success) return validationError(parseResult.error as ZodError);

    const service = await getService();
    const task = await service.updateStatus(id, parseResult.data.status);
    return task ? ok(task) : notFound(`Task ${id} not found`);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/{id}
// ---------------------------------------------------------------------------
async function deleteTask(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const id = req.params['id'];
  ctx.log('deleteTask called', { id });
  try {
    const service = await getService();
    const deleted = await service.deleteTask(id);
    return deleted ? noContent() : notFound(`Task ${id} not found`);
  } catch (err) {
    return internalError(err);
  }
}

// ---------------------------------------------------------------------------
// Register routes with Azure Functions v4 model
// ---------------------------------------------------------------------------
app.http('listTasks', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'tasks',
  handler: listTasks,
});

app.http('getTask', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'tasks/{id}',
  handler: getTask,
});

app.http('createTask', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'tasks',
  handler: createTask,
});

app.http('updateTask', {
  methods: ['PUT', 'PATCH'],
  authLevel: 'anonymous',
  route: 'tasks/{id}',
  handler: updateTask,
});

app.http('updateTaskStatus', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'tasks/{id}/status',
  handler: updateTaskStatus,
});

app.http('deleteTask', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'tasks/{id}',
  handler: deleteTask,
});


app.http("healthCheck", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthCheck,
});
