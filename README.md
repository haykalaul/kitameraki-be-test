# Task Management — Backend (Azure Functions + Cosmos DB)

Azure Functions v4 (Node.js / TypeScript) API for the Task Management App.  
The API is consumed by the `../frontend` React SPA.

---

## Architecture

```
src/
├── db/              cosmosClient.ts           — shared Cosmos client, dual-container provisioning
├── functions/       tasks.ts, formSettings.ts — Azure Functions HTTP handlers (route → validate → service)
├── middleware/      response.ts               — Consistent HTTP response helpers
├── repositories/    taskRepository.ts, formConfigRepository.ts — Dedicated Cosmos repositories
├── schemas/         index.ts                  — Zod schemas for input & layout validation
├── services/        taskService.ts, formSettingsService.ts     — Business logic & custom field validation
├── types/           index.ts                  — Shared TypeScript interfaces
└── utils/           config.ts                 — Centralised, fail-fast env config
scripts/
└── migrate-data-separation.ts                 — Idempotent data separation migration script
tests/
└── unit/            taskService.test.ts, formSettings.test.ts, formConfigRepository.test.ts, dataSeparation.test.ts, response.test.ts
```

### Cosmos DB Containers & Data Separation
1. **`tasks` Container**:
   - **Partition Key:** `/_partitionKey` (mirrors `status`: `todo`, `in_progress`, `done`).
   - Stores only task items. Custom field values are stored in `customFields` keyed by stable field ID.
   - Task queries use parameterized filters and include defense-in-depth task discriminators.
2. **`formConfig` Container**:
   - **Partition Key:** `/configType` (fixed value: `"task-form"`).
   - Stores form configuration exclusively (`id: "task-form"`). Point reads require only ~1.0 RU. Configuration documents are completely isolated and never returned in task list queries.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Azure Functions Core Tools | v4 |
| Docker Desktop | ≥ 4.x (for Cosmos DB emulator) |

Install Azure Functions Core Tools:
```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

---

## Local Development with Cosmos DB Emulator

### 1. Start the emulator

```bash
docker pull mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-latest

docker run -d \
  -p 8081:8081 \
  -p 1234:1234 \
  --name cosmos-emulator \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-latest
```

Wait ~30 seconds, then verify:
- **Endpoint:** https://localhost:8081
- **Data Explorer:** https://localhost:1234

> **TLS Note:** The emulator uses a self-signed certificate. The backend automatically
> disables TLS verification when `COSMOS_DB_ENDPOINT` contains `localhost`. This is only
> active in local dev — production always uses the real certificate.

### 2. Configure environment

```bash
cp local.settings.example.json local.settings.json
```

`local.settings.json` is pre-populated for the emulator and is **git-ignored**.

The emulator's well-known default key (not a real secret) is:
```
C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMssZlvi0iFL+2uxFw==
```

### 3. Install and start

```bash
npm install
npm run dev        # builds TypeScript, then starts func
```

The API will be available at: **http://localhost:7071/api**

---

## Environment Variables
 
| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `COSMOS_DB_ENDPOINT` | Cosmos DB / emulator endpoint | — | `http://localhost:8081` |
| `COSMOS_DB_KEY` | Primary key | — | `C2y6y...` (emulator default) |
| `COSMOS_DB_DATABASE` | Database name | `TaskManagementDB` | `TaskManagementDB` |
| `COSMOS_TASKS_CONTAINER` | Tasks container name | `tasks` | `tasks` |
| `COSMOS_FORM_CONFIG_CONTAINER` | Form configuration container name | `formConfig` | `formConfig` |
| `COSMOS_DB_CONTAINER` | Legacy container fallback | `tasks` | `tasks` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:5173` | `http://localhost:5173` |

---

## Data Migration

To separate existing data where the form config document resided in the `tasks` container, run the migration script:

```bash
# 1. Dry-run mode (safely inspect planned changes without altering data)
npm run migrate

# 2. Live execution (copies doc to formConfig, verifies, and deletes legacy doc from tasks)
npm run migrate:execute
```

- **Idempotent**: Re-running the script detects that `formConfig` is populated and `tasks` is clean, exiting safely without error.
- **Safety Guard**: Executing against remote Azure endpoints requires `--confirm-remote` to prevent unintended operations against cloud environments.

---

## API Reference

Base URL: `http://localhost:7071/api`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | Paginated list with filters |
| GET | `/tasks/{id}` | Get single task |
| POST | `/tasks` | Create task (validates customFields against active schema) |
| PUT | `/tasks/{id}` | Update task (validates customFields against active schema) |
| PATCH | `/tasks/{id}/status` | Change status only |
| DELETE | `/tasks/{id}` | Delete task |
| GET | `/form-settings` | Get current form settings (returns defaults if none saved) |
| PUT | `/form-settings` | Update form settings (validates max 2 cols/row, unique IDs, types) |
| POST | `/form-settings/reset` | Reset form configuration to Part 1 defaults |

### Query Parameters (`GET /tasks`)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 10 | Items per page (max 100) |
| `status` | `todo\|in_progress\|done` | — | Filter by status |
| `priority` | `low\|medium\|high` | — | Filter by priority |
| `search` | string | — | Search title/description |
| `sortBy` | string | `createdAt` | Sort field |
| `sortOrder` | `asc\|desc` | `desc` | Sort direction |

### Response Shapes

**List:**
```json
{ "items": [...], "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }
```

**Error:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

---

## Scripts

```bash
npm run build           # Compile TypeScript → dist/
npm run dev             # Build + func start (local dev)
npm run test            # Vitest unit tests
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit
npm run migrate         # Run data separation migration in dry-run mode
npm run migrate:execute # Run data separation migration live
```

---

## Production Deployment

1. Set App Settings in Azure (same env vars, real Cosmos connection string).
2. `func azure functionapp publish <your-app-name>`

Never commit `local.settings.json`. Use Key Vault references for production secrets.
