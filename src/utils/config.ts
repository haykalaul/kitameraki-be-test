import * as fs from 'fs';
import * as path from 'path';

/**
 * Centralised, validated environment configuration.
 * Reads from process.env (populated by local.settings.json in dev,
 * App Settings in Azure). In CLI scripts, automatically reads local.settings.json if present.
 */

if (!process.env['COSMOS_DB_ENDPOINT']) {
  const localSettingsPath = path.resolve(process.cwd(), 'local.settings.json');
  if (fs.existsSync(localSettingsPath)) {
    try {
      const raw = fs.readFileSync(localSettingsPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.Values && typeof parsed.Values === 'object') {
        for (const [k, v] of Object.entries(parsed.Values)) {
          if (!process.env[k] && typeof v === 'string') {
            process.env[k] = v;
          }
        }
      }
    } catch {
      // Ignore; missing required variables will be caught below
    }
  }
}

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

function requireEnv(key: string): string {
  return getEnv(key);
}

const defaultTasksContainer = process.env['COSMOS_DB_CONTAINER'] || 'tasks';

export const config = {
  cosmos: {
    endpoint: requireEnv('COSMOS_DB_ENDPOINT'),
    key: requireEnv('COSMOS_DB_KEY'),
    database: requireEnv('COSMOS_DB_DATABASE'),
    tasksContainer: getEnv('COSMOS_TASKS_CONTAINER', defaultTasksContainer),
    formConfigContainer: getEnv('COSMOS_FORM_CONFIG_CONTAINER', 'formConfig'),
    container: getEnv('COSMOS_DB_CONTAINER', defaultTasksContainer),
  },
  cors: {
    allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:5173').split(','),
  },
} as const;
