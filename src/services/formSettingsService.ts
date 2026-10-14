import type { FormSettings, FormField } from '../types';
import type { FormSettingsRepository } from '../repositories/formSettingsRepository';

export interface SaveFormSettingsInput {
  title: string;
  description?: string;
  fields: FormField[];
  version?: number;
}

export class FormSettingsService {
  constructor(private readonly repo: FormSettingsRepository) {}

  async getSettings(): Promise<FormSettings> {
    return this.repo.getSettings();
  }

  async saveSettings(input: SaveFormSettingsInput, ifMatchEtag?: string): Promise<FormSettings> {
    return this.repo.saveSettings(input, ifMatchEtag);
  }

  async resetSettings(): Promise<FormSettings> {
    return this.repo.resetSettings();
  }
}
