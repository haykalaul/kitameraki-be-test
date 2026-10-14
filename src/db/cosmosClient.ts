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
let _container: Container | null = null;

function getClient(): CosmosClient {
  if (!_client) {
    _client = new CosmosClient({
      endpoint: config.cosmos.endpoint,
      key: config.cosmos.key,
    });
  }
  return _client;
}

export async function getContainer(): Promise<Container> {
  if (_container) return _container;

  const client = getClient();

  // Ensure DB and container exist (idempotent; safe to call on every cold start)
  const { database } = await client.databases.createIfNotExists({
    id: config.cosmos.database,
  });

  const { container } = await database.containers.createIfNotExists({
    id: config.cosmos.container,
    partitionKey: { paths: ['/_partitionKey'] },
    // Throughput only set on initial creation — emulator ignores it
  });
  _container = container;

  return _container;
}
