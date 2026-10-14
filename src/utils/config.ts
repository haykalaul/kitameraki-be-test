/**
 * Centralised, validated environment configuration.
 * Reads from process.env (populated by local.settings.json in dev,
 * App Settings in Azure).
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  cosmos: {
    endpoint: requireEnv('COSMOS_DB_ENDPOINT'),
    key: requireEnv('COSMOS_DB_KEY'),
    database: requireEnv('COSMOS_DB_DATABASE'),
    container: requireEnv('COSMOS_DB_CONTAINER'),
  },
  cors: {
    allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:5173').split(','),
  },
} as const;
