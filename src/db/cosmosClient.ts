import { CosmosClient, Container } from '@azure/cosmos';
import { config } from '../utils/config';

/**
 * Single shared Cosmos client — reused across all function invocations.
 * Creating a new client per request wastes connections and is an anti-pattern.
 *
 * The Cosmos DB vNext Linux emulator uses plain HTTP on port 8081.
 * The legacy Windows emulator uses HTTPS. This client handles both.
 */

let _client: CosmosClient | null = null;
let _tasksContainer: Container | null = null;
let _formConfigContainer: Container | null = null;

function getClient(): CosmosClient {
  if (!_client) {
    _client = new CosmosClient({
      endpoint: config.cosmos.endpoint,
      key: config.cosmos.key,
    });
  }
  return _client;
}

export function getCosmosClient(): CosmosClient {
  return getClient();
}

export async function getTasksContainer(): Promise<Container> {
  if (_tasksContainer) return _tasksContainer;

  const client = getClient();
  const { database } = await client.databases.createIfNotExists({
    id: config.cosmos.database,
  });

  const { container } = await database.containers.createIfNotExists({
    id: config.cosmos.tasksContainer,
    partitionKey: { paths: ['/_partitionKey'] },
  });
  _tasksContainer = container;

  return _tasksContainer;
}

export async function getFormConfigContainer(): Promise<Container> {
  if (_formConfigContainer) return _formConfigContainer;

  const client = getClient();
  const { database } = await client.databases.createIfNotExists({
    id: config.cosmos.database,
  });

  const { container } = await database.containers.createIfNotExists({
    id: config.cosmos.formConfigContainer,
    partitionKey: { paths: ['/configType'] },
  });
  _formConfigContainer = container;

  return _formConfigContainer;
}

/** Legacy alias for backwards-compatibility */
export async function getContainer(): Promise<Container> {
  return getTasksContainer();
}
