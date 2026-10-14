import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TaskRepository } from '../../src/repositories/taskRepository';
import { TaskService } from '../../src/services/taskService';
import type { Task } from '../../src/types';

const mockTask: Task = {
  id: 'abc-123',
  title: 'Test Task',
  status: 'todo',
  priority: 'medium',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockRepo = {
  list: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} satisfies Partial<TaskRepository> as unknown as TaskRepository;

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaskService(mockRepo);
  });

  it('getTask returns task when found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(mockTask);
    const result = await service.getTask('abc-123');
    expect(result).toEqual(mockTask);
    expect(mockRepo.findById).toHaveBeenCalledWith('abc-123');
  });

  it('getTask returns null when not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);
    const result = await service.getTask('nonexistent');
    expect(result).toBeNull();
  });

  it('createTask delegates to repo.create', async () => {
    vi.mocked(mockRepo.create).mockResolvedValue(mockTask);
    const input = { title: 'Test', status: 'todo' as const, priority: 'medium' as const };
    const result = await service.createTask(input);
    expect(result).toEqual(mockTask);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it('deleteTask returns true on success', async () => {
    vi.mocked(mockRepo.delete).mockResolvedValue(true);
    const result = await service.deleteTask('abc-123');
    expect(result).toBe(true);
  });

  it('deleteTask returns false when task not found', async () => {
    vi.mocked(mockRepo.delete).mockResolvedValue(false);
    const result = await service.deleteTask('nonexistent');
    expect(result).toBe(false);
  });

  it('updateStatus calls repo.update with just the status', async () => {
    const updated = { ...mockTask, status: 'done' as const };
    vi.mocked(mockRepo.update).mockResolvedValue(updated);
    const result = await service.updateStatus('abc-123', 'done');
    expect(result?.status).toBe('done');
    expect(mockRepo.update).toHaveBeenCalledWith('abc-123', { status: 'done' });
  });
});
