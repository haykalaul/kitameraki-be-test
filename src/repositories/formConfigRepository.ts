import { Container } from '@azure/cosmos';
import type { FormSettings, FormSettingsDocument } from '../types';
import { DEFAULT_FORM_SETTINGS } from '../types';

/**
 * Repository for the formConfig container.
 * Stores configuration documents exclusively, partitioned by /configType.
 * Never stores or queries task documents.
 */
export class FormConfigRepository {
  private readonly configType = 'task-form';
  private readonly docId = 'task-form';

  constructor(private readonly container: Container) {}

  async getSettings(): Promise<FormSettings> {
    try {
      const { resource } = await this.container
        .item(this.docId, this.configType)
        .read<FormSettingsDocument>();
      if (!resource) {
        return { ...DEFAULT_FORM_SETTINGS };
      }
      return toFormSettings(resource);
    } catch (err: unknown) {
      const error = err as { code?: number; status?: number };
      if (error.code === 404 || error.status === 404) {
        return { ...DEFAULT_FORM_SETTINGS };
      }
      throw err;
    }
  }

  async saveSettings(
    settings: { title: string; description?: string; fields: FormSettings['fields'] },
    ifMatchEtag?: string
  ): Promise<FormSettings> {
    const existing = await this.getSettings();
    const newVersion = (existing.version || 0) + 1;
    const now = new Date().toISOString();

    const doc: FormSettingsDocument = {
      id: this.docId,
      configType: this.configType,
      title: settings.title,
      description: settings.description,
      fields: settings.fields,
      version: newVersion,
      updatedAt: now,
    };

    const options = ifMatchEtag && existing._etag
      ? { accessCondition: { type: 'IfMatch' as const, condition: ifMatchEtag } }
      : undefined;

    const { resource } = await this.container.items.upsert<FormSettingsDocument>(doc, options);
    if (!resource) throw new Error('Failed to save form settings: no resource returned');
    return toFormSettings(resource);
  }

  async resetSettings(): Promise<FormSettings> {
    const now = new Date().toISOString();
    const doc: FormSettingsDocument = {
      ...DEFAULT_FORM_SETTINGS,
      updatedAt: now,
      configType: this.configType,
    };
    const { resource } = await this.container.items.upsert<FormSettingsDocument>(doc);
    if (!resource) throw new Error('Failed to reset form settings');
    return toFormSettings(resource);
  }
}

function toFormSettings(doc: FormSettingsDocument): FormSettings {
  return {
    id: 'task-form',
    title: doc.title,
    description: doc.description,
    fields: doc.fields,
    version: doc.version,
    updatedAt: doc.updatedAt,
    _etag: (doc as unknown as { _etag?: string })._etag,
  };
}

/** Legacy alias for backwards compatibility */
export { FormConfigRepository as FormSettingsRepository };
