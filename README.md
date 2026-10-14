# Task Management — Backend (Azure Functions + Cosmos DB)

Azure Functions v4 (Node.js / TypeScript) API for the Task Management App.  
The API is consumed by the `../frontend` React SPA.

---

## Architecture

```
src/
├── db/              cosmosClient.ts  — singleton Cosmos client, auto-creates DB & container
├── functions/       tasks.ts         — Azure Functions HTTP handlers (route → validate → service)
├── middleware/      response.ts      — Consistent HTTP response helpers
├── repositories/    taskRepository.ts — All Cosmos queries (fully parameterised)
├── schemas/         index.ts         — Zod schemas for input validation
├── services/        taskService.ts   — Business logic
├── types/           index.ts         — Shared TypeScript interfaces
└── utils/           config.ts        — Centralised, fail-fast env config
tests/
└── unit/            taskService.test.ts
```

**Partition key:** `/_partitionKey` (mirrors `status`). This allows efficient per-status queries
while keeping cross-partition list queries bounded via OFFSET/LIMIT.

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

| Variable | Description | Example |
|----------|-------------|---------|
| `COSMOS_DB_ENDPOINT` | Cosmos DB / emulator endpoint | `https://localhost:8081` |
| `COSMOS_DB_KEY` | Primary key | `C2y6y...` (emulator default) |
| `COSMOS_DB_DATABASE` | Database name | `TaskManagementDB` |
| `COSMOS_DB_CONTAINER` | Container name | `tasks` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:5173` |

---

## API Reference

Base URL: `http://localhost:7071/api`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | Paginated list with filters |
| GET | `/tasks/{id}` | Get single task |
| POST | `/tasks` | Create task |
| PUT | `/tasks/{id}` | Update task |
| PATCH | `/tasks/{id}/status` | Change status only |
| DELETE | `/tasks/{id}` | Delete task |

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
npm run build       # Compile TypeScript → dist/
npm run dev         # Build + func start (local dev)
npm run test        # Vitest unit tests
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```

---

## Production Deployment

1. Set App Settings in Azure (same env vars, real Cosmos connection string).
2. `func azure functionapp publish <your-app-name>`

Never commit `local.settings.json`. Use Key Vault references for production secrets.
