/* eslint-disable no-console */
/**
 * Data Separation Migration Script
 *
 * Migrates form configuration from the legacy shared 'tasks' container
 * to the dedicated 'formConfig' container (partition key: /configType).
 *
 * Usage:
 *   Dry-run (default):
 *     npm run migrate
 *     # or: node dist/scripts/migrate-data-separation.js --dry-run
 *
 *   Live execution:
 *     npm run migrate:execute
 *     # or: node dist/scripts/migrate-data-separation.js --execute
 *
 * Safety:
 *   If running against an external/remote Azure account, requires the
 *   '--confirm-remote' flag to prevent accidental execution.
 */

import { CosmosClient } from '@azure/cosmos';
import { config } from '../src/utils/config';
import { DEFAULT_FORM_SETTINGS, FormSettingsDocument } from '../src/types';

interface MigrationOptions {
  isDryRun: boolean;
  confirmRemote: boolean;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const confirmRemote = args.includes('--confirm-remote');
  return {
    isDryRun: !isExecute,
    confirmRemote,
  };
}

function isLocalEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('localhost') ||
    endpoint.includes('127.0.0.1') ||
    endpoint.includes('0.0.0.0')
  );
}

export async function runMigration(options?: Partial<MigrationOptions>): Promise<void> {
  const parsed = options ? { isDryRun: true, confirmRemote: false, ...options } : parseArgs();
  const { isDryRun, confirmRemote } = parsed;

  console.log('----------------------------------------------------');
  console.log('🚀 Cosmos DB Data Separation Migration');
  console.log(`Mode: ${isDryRun ? '🔍 DRY-RUN (no data will be altered)' : '⚡ LIVE EXECUTION'}`);
  console.log(`Database: ${config.cosmos.database}`);
  console.log(`Tasks Container: ${config.cosmos.tasksContainer}`);
  console.log(`Form Config Container: ${config.cosmos.formConfigContainer}`);
  console.log(`Endpoint: ${config.cosmos.endpoint}`);
  console.log('----------------------------------------------------');

  // Safety check for non-local endpoints
  if (!isLocalEndpoint(config.cosmos.endpoint) && !confirmRemote) {
    console.error(
      '❌ BLOCKED: Destructive operations against non-local Azure accounts require the "--confirm-remote" flag.'
    );
    process.exit(1);
  }

  const client = new CosmosClient({
    endpoint: config.cosmos.endpoint,
    key: config.cosmos.key,
  });

  // 1. Ensure Database exists
  const { database } = await client.databases.createIfNotExists({
    id: config.cosmos.database,
  });

  // 2. Ensure formConfig container exists
  let formConfigContainer;
  if (!isDryRun) {
    const res = await database.containers.createIfNotExists({
      id: config.cosmos.formConfigContainer,
      partitionKey: { paths: ['/configType'] },
    });
    formConfigContainer = res.container;
    console.log(`✓ Ensured container '${config.cosmos.formConfigContainer}' exists (PK: /configType).`);
  } else {
    try {
      const existing = database.container(config.cosmos.formConfigContainer);
      await existing.read();
      formConfigContainer = existing;
      console.log(`[DRY-RUN] Container '${config.cosmos.formConfigContainer}' exists.`);
    } catch {
      console.log(`[DRY-RUN] Would create container '${config.cosmos.formConfigContainer}' with PK: /configType.`);
    }
  }

  const tasksContainer = database.container(config.cosmos.tasksContainer);

  // 3. Check for legacy config in 'tasks' container
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.id = @id',
    parameters: [{ name: '@id', value: 'task-form' }],
  };

  let legacyDocs: FormSettingsDocument[] = [];
  try {
    const { resources } = await tasksContainer.items.query<FormSettingsDocument>(querySpec).fetchAll();
    legacyDocs = resources;
  } catch (err) {
    console.warn(`Note: Could not query tasks container (may not exist yet): ${(err as Error).message}`);
  }

  const hasLegacyInTasks = legacyDocs.length > 0;
  const legacyDoc = hasLegacyInTasks ? legacyDocs[0] : null;

  // 4. Check for existing config in 'formConfig' container
  let hasInFormConfig = false;
  if (formConfigContainer) {
    try {
      const { resource } = await formConfigContainer
        .item('task-form', 'task-form')
        .read<FormSettingsDocument>();
      hasInFormConfig = !!resource;
    } catch {
      hasInFormConfig = false;
    }
  }

  console.log(`State assessment:`);
  console.log(` - Legacy 'task-form' in '${config.cosmos.tasksContainer}': ${hasLegacyInTasks ? 'FOUND' : 'NOT FOUND'}`);
  console.log(` - Config 'task-form' in '${config.cosmos.formConfigContainer}': ${hasInFormConfig ? 'FOUND' : 'NOT FOUND'}`);

  // 5. Migration logic
  if (!hasLegacyInTasks && hasInFormConfig) {
    console.log('\n✅ IDEMPOTENT CHECK: Data separation is already complete. Nothing to migrate.');
    return;
  }

  if (hasLegacyInTasks) {
    const docToMigrate: FormSettingsDocument = {
      id: 'task-form',
      configType: 'task-form',
      title: legacyDoc?.title ?? DEFAULT_FORM_SETTINGS.title,
      description: legacyDoc?.description ?? DEFAULT_FORM_SETTINGS.description,
      fields: legacyDoc?.fields ?? DEFAULT_FORM_SETTINGS.fields,
      version: legacyDoc?.version ?? 1,
      updatedAt: legacyDoc?.updatedAt ?? new Date().toISOString(),
    };

    if (!hasInFormConfig) {
      if (isDryRun) {
        console.log(`[DRY-RUN] Would copy 'task-form' into '${config.cosmos.formConfigContainer}' (PK: /configType, configType: 'task-form').`);
      } else if (formConfigContainer) {
        await formConfigContainer.items.upsert(docToMigrate);
        console.log(`✓ Copied 'task-form' into '${config.cosmos.formConfigContainer}'.`);
      }
    } else {
      console.log(`- Config already present in '${config.cosmos.formConfigContainer}'.`);
    }

    // Delete legacy doc from tasks
    const legacyPk = legacyDoc?._partitionKey || 'form-settings';
    if (isDryRun) {
      console.log(`[DRY-RUN] Would delete legacy 'task-form' from '${config.cosmos.tasksContainer}' (PK: '${legacyPk}').`);
    } else {
      await tasksContainer.item('task-form', legacyPk).delete();
      console.log(`✓ Deleted legacy 'task-form' from '${config.cosmos.tasksContainer}'.`);
    }
  } else if (!hasInFormConfig) {
    // Neither container has config, seed default into formConfig
    const defaultDoc: FormSettingsDocument = {
      ...DEFAULT_FORM_SETTINGS,
      configType: 'task-form',
      updatedAt: new Date().toISOString(),
    };

    if (isDryRun) {
      console.log(`[DRY-RUN] No config document found. Would seed DEFAULT_FORM_SETTINGS into '${config.cosmos.formConfigContainer}'.`);
    } else if (formConfigContainer) {
      await formConfigContainer.items.upsert(defaultDoc);
      console.log(`✓ Seeded default form settings into '${config.cosmos.formConfigContainer}'.`);
    }
  }

  console.log('\n🎉 Migration run completed successfully.');
}

// Execute directly if run as a script
if (require.main === module) {
  runMigration().catch((err) => {
    console.error('❌ Migration failed with error:', err);
    process.exit(1);
  });
}
