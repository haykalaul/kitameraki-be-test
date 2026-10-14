import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateFormSettingsSchema } from '../../src/schemas';
import {
  validateTaskCustomFields,
  CustomFieldValidationError,
} from '../../src/services/taskService';
import { FormSettingsService } from '../../src/services/formSettingsService';
import type { FormSettingsRepository } from '../../src/repositories/formSettingsRepository';
import type { FormSettings } from '../../src/types';
import { DEFAULT_FORM_SETTINGS } from '../../src/types';

describe('updateFormSettingsSchema', () => {
  it('accepts valid form settings with at most 2 columns per row', () => {
    const input = {
      title: 'Custom Form',
      description: 'Form with custom fields',
      fields: [
        { id: 'f1', label: 'Field 1', type: 'text', row: 0, column: 0 },
        { id: 'f2', label: 'Field 2', type: 'date', row: 0, column: 1 },
        { id: 'f3', label: 'Field 3', type: 'email', row: 1, column: 0 },
      ],
    };
    const result = updateFormSettingsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects duplicate field IDs', () => {
    const input = {
      title: 'Custom Form',
      fields: [
        { id: 'f1', label: 'Field 1', type: 'text', row: 0, column: 0 },
        { id: 'f1', label: 'Field 2', type: 'date', row: 1, column: 0 },
      ],
    };
    const result = updateFormSettingsSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Duplicate field ID'))).toBe(true);
    }
  });

  it('rejects duplicate slots in the same row', () => {
    const input = {
      title: 'Custom Form',
      fields: [
        { id: 'f1', label: 'Field 1', type: 'text', row: 0, column: 0 },
        { id: 'f2', label: 'Field 2', type: 'date', row: 0, column: 0 },
      ],
    };
    const result = updateFormSettingsSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('is occupied by multiple fields'))).toBe(true);
    }
  });

  it('rejects invalid field types', () => {
    const input = {
      title: 'Custom Form',
      fields: [
        { id: 'f1', label: 'Field 1', type: 'checkbox', row: 0, column: 0 },
      ],
    };
    const result = updateFormSettingsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('validateTaskCustomFields', () => {
  const testSettings: FormSettings = {
    id: 'task-form',
    title: 'Test Form',
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
    fields: [
      { id: 'title', label: 'Title', type: 'text', builtIn: true, row: 0, column: 0 },
      { id: 'clientEmail', label: 'Client Email', type: 'email', required: true, builtIn: false, row: 1, column: 0 },
      { id: 'reviewDate', label: 'Review Date', type: 'date', required: false, builtIn: false, row: 1, column: 1 },
      { id: 'scheduledTime', label: 'Scheduled Time', type: 'datetime', required: false, builtIn: false, row: 2, column: 0 },
    ],
  };

  it('passes when valid custom fields are provided', () => {
    expect(() => {
      validateTaskCustomFields(
        {
          clientEmail: 'test@example.com',
          reviewDate: '2026-10-15',
          scheduledTime: '2026-10-15T14:30:00Z',
        },
        testSettings
      );
    }).not.toThrow();
  });

  it('throws CustomFieldValidationError when an unknown custom field is present', () => {
    expect(() => {
      validateTaskCustomFields(
        {
          clientEmail: 'test@example.com',
          unknownField: 'value',
        },
        testSettings
      );
    }).toThrow(CustomFieldValidationError);
  });

  it('throws when a required custom field is missing on creation', () => {
    expect(() => {
      validateTaskCustomFields(
        {
          reviewDate: '2026-10-15',
        },
        testSettings,
        false
      );
    }).toThrow(CustomFieldValidationError);
  });

  it('throws when email format is invalid', () => {
    expect(() => {
      validateTaskCustomFields(
        {
          clientEmail: 'not-an-email',
        },
        testSettings
      );
    }).toThrow(CustomFieldValidationError);
  });

  it('throws when date format is invalid', () => {
    expect(() => {
      validateTaskCustomFields(
        {
          clientEmail: 'test@example.com',
          reviewDate: '15-10-2026',
        },
        testSettings
      );
    }).toThrow(CustomFieldValidationError);
  });

  it('throws when datetime format is invalid', () => {
    expect(() => {
      validateTaskCustomFields(
        {
          clientEmail: 'test@example.com',
          scheduledTime: 'not-a-datetime',
        },
        testSettings
      );
    }).toThrow(CustomFieldValidationError);
  });
});

describe('FormSettingsService', () => {
  let service: FormSettingsService;
  const mockRepo = {
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
  } satisfies Partial<FormSettingsRepository> as unknown as FormSettingsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FormSettingsService(mockRepo);
  });

  it('getSettings delegates to repo.getSettings', async () => {
    vi.mocked(mockRepo.getSettings).mockResolvedValue(DEFAULT_FORM_SETTINGS);
    const result = await service.getSettings();
    expect(result).toEqual(DEFAULT_FORM_SETTINGS);
    expect(mockRepo.getSettings).toHaveBeenCalled();
  });

  it('saveSettings delegates to repo.saveSettings', async () => {
    const updated = { ...DEFAULT_FORM_SETTINGS, title: 'Updated Form', version: 2 };
    vi.mocked(mockRepo.saveSettings).mockResolvedValue(updated);
    const input = { title: 'Updated Form', fields: DEFAULT_FORM_SETTINGS.fields };
    const result = await service.saveSettings(input, 'test-etag');
    expect(result).toEqual(updated);
    expect(mockRepo.saveSettings).toHaveBeenCalledWith(input, 'test-etag');
  });

  it('resetSettings delegates to repo.resetSettings', async () => {
    vi.mocked(mockRepo.resetSettings).mockResolvedValue(DEFAULT_FORM_SETTINGS);
    const result = await service.resetSettings();
    expect(result).toEqual(DEFAULT_FORM_SETTINGS);
    expect(mockRepo.resetSettings).toHaveBeenCalled();
  });
});
