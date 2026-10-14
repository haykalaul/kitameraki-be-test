import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Container } from '@azure/cosmos';
import { FormConfigRepository } from '../../src/repositories/formConfigRepository';
import { DEFAULT_FORM_SETTINGS } from '../../src/types';

describe('FormConfigRepository', () => {
  let mockContainer: Partial<Container>;
  let repository: FormConfigRepository;

  const mockItem = {
    read: vi.fn(),
  };

  const mockItems = {
    upsert: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContainer = {
      item: vi.fn().mockReturnValue(mockItem),
      items: mockItems as unknown as Container['items'],
    };
    repository = new FormConfigRepository(mockContainer as Container);
  });

  describe('getSettings', () => {
    it('queries using docId "task-form" and partition key "task-form"', async () => {
      mockItem.read.mockResolvedValue({
        resource: {
          id: 'task-form',
          configType: 'task-form',
          title: 'Custom Title',
          fields: DEFAULT_FORM_SETTINGS.fields,
          version: 2,
          updatedAt: '2026-01-01T00:00:00Z',
          _etag: '"etag-123"',
        },
      });

      const result = await repository.getSettings();

      expect(mockContainer.item).toHaveBeenCalledWith('task-form', 'task-form');
      expect(result.title).toBe('Custom Title');
      expect(result.version).toBe(2);
      expect(result._etag).toBe('"etag-123"');
    });

    it('returns DEFAULT_FORM_SETTINGS when document does not exist (404)', async () => {
      mockItem.read.mockRejectedValue({ code: 404 });

      const result = await repository.getSettings();

      expect(result.title).toBe(DEFAULT_FORM_SETTINGS.title);
      expect(result.fields).toEqual(DEFAULT_FORM_SETTINGS.fields);
    });

    it('returns DEFAULT_FORM_SETTINGS when resource is null', async () => {
      mockItem.read.mockResolvedValue({ resource: null });

      const result = await repository.getSettings();

      expect(result.title).toBe(DEFAULT_FORM_SETTINGS.title);
    });
  });

  describe('saveSettings', () => {
    it('upserts document with configType "task-form" and incremented version', async () => {
      mockItem.read.mockResolvedValue({
        resource: {
          ...DEFAULT_FORM_SETTINGS,
          version: 3,
          _etag: '"existing-etag"',
        },
      });

      mockItems.upsert.mockResolvedValue({
        resource: {
          id: 'task-form',
          configType: 'task-form',
          title: 'Updated Form',
          fields: DEFAULT_FORM_SETTINGS.fields,
          version: 4,
          updatedAt: '2026-02-01T00:00:00Z',
          _etag: '"new-etag"',
        },
      });

      const result = await repository.saveSettings({
        title: 'Updated Form',
        fields: DEFAULT_FORM_SETTINGS.fields,
      });

      expect(mockItems.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-form',
          configType: 'task-form',
          title: 'Updated Form',
          version: 4,
        }),
        undefined
      );
      expect(result.version).toBe(4);
      expect(result._etag).toBe('"new-etag"');
    });

    it('passes IfMatch accessCondition when ifMatchEtag is provided', async () => {
      mockItem.read.mockResolvedValue({
        resource: {
          ...DEFAULT_FORM_SETTINGS,
          version: 1,
          _etag: '"match-etag"',
        },
      });

      mockItems.upsert.mockResolvedValue({
        resource: {
          id: 'task-form',
          configType: 'task-form',
          title: 'ETag Test',
          fields: DEFAULT_FORM_SETTINGS.fields,
          version: 2,
          updatedAt: '2026-02-01T00:00:00Z',
          _etag: '"updated-etag"',
        },
      });

      await repository.saveSettings(
        { title: 'ETag Test', fields: DEFAULT_FORM_SETTINGS.fields },
        '"match-etag"'
      );

      expect(mockItems.upsert).toHaveBeenCalledWith(
        expect.any(Object),
        { accessCondition: { type: 'IfMatch', condition: '"match-etag"' } }
      );
    });
  });

  describe('resetSettings', () => {
    it('upserts default settings with configType "task-form"', async () => {
      mockItems.upsert.mockResolvedValue({
        resource: {
          ...DEFAULT_FORM_SETTINGS,
          configType: 'task-form',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      });

      const result = await repository.resetSettings();

      expect(mockItems.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-form',
          configType: 'task-form',
          title: DEFAULT_FORM_SETTINGS.title,
        })
      );
      expect(result.title).toBe(DEFAULT_FORM_SETTINGS.title);
    });
  });
});
