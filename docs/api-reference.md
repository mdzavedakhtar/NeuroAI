# NeuroStack AI — API Reference

> **Base URL**: `http://localhost:5000/api`
> **Interactive Docs**: `http://localhost:5000/api-docs` (Swagger UI)

## Authentication

All protected routes require a valid JWT or API key.

| Method | Header |
|---|---|
| JWT | `Authorization: Bearer <token>` |
| API Key | `X-API-Key: ns_<key>` or `Authorization: Bearer ns_<key>` |

---

## Auth Endpoints

### POST /auth/register
Register a new user.

**Body**:
```json
{ "name": "Alice", "email": "alice@example.com", "password": "SecurePass123!" }
```

### POST /auth/login
Authenticate and receive a JWT token.

**Body**:
```json
{ "email": "alice@example.com", "password": "SecurePass123!" }
```

**Response**:
```json
{ "success": true, "token": "eyJ...", "user": { "id": "...", "name": "Alice" } }
```

### POST /auth/google
Authenticate via Google OAuth ID token.

---

## Knowledge (Documents) Endpoints

### POST /knowledge/upload
Upload a document (PDF, DOCX, XLSX, PPTX). `multipart/form-data`.

**Form field**: `file`

### POST /knowledge/:id/index
Trigger BullMQ ingestion pipeline for a previously uploaded document.

### GET /knowledge/sources
List all indexed documents for the authenticated user.

### DELETE /knowledge/:id
Delete a document and its associated chunks.

### POST /knowledge/url *(new)*
Scrape a public web page and ingest it.

**Body**:
```json
{ "url": "https://example.com/article" }
```

### POST /knowledge/github *(new)*
Ingest a GitHub repository's source files.

**Body**:
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "token": "ghp_optional_for_private_repos"
}
```

---

## Chat Endpoints

### GET /chat/conversations
List all conversations for the authenticated user.

### POST /chat/conversations
Create a new conversation session.

**Body**:
```json
{ "knowledgeId": "64a1..." }
```

### GET /chat/conversations/:id/messages
Retrieve message history for a conversation.

### POST /chat/conversations/:id/messages
Send a message and receive a RAG-grounded answer.

**Body**:
```json
{ "content": "Summarize the key findings." }
```

**Response**:
```json
{
  "success": true,
  "message": { "role": "assistant", "content": "...", "sources": [] }
}
```

---

## Tools Endpoints

### POST /tools/:toolName
Run one of the 10 workspace tools.

**Available tools**: `summarizer`, `rag-search`, `bug-detector`, `test-generator`, `data-analyzer`, `content-rewriter`, `translator`, `email-composer`, `code-explainer`, `graph-query`

**Body** (varies by tool):
```json
{ "text": "...", "code": "...", "query": "...", "language": "Spanish" }
```

---

## Graph Endpoints

### POST /graph/query
Query the Neo4j knowledge graph.

**Body**:
```json
{ "query": "machine learning", "type": "keyword" }
```

### GET /graph/stats
Get graph statistics (node counts, relationship counts).

---

## Analytics Endpoints *(new)*

### GET /analytics/stats
Get platform analytics (requires auth).

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalUsers": 42,
    "totalDocuments": 128,
    "totalQueries": 1840,
    "activeUsers7d": 12,
    "feedbackScore": 0.87,
    "avgResponseTimeMs": 1240,
    "topKeywords": [{ "topic": "machine learning", "count": 34 }]
  }
}
```

---

## API Key Management Endpoints

### GET /apikeys
List all API keys for the user.

### POST /apikeys
Create a new API key.

**Body**:
```json
{ "name": "My Integration", "permissions": ["chat", "search"] }
```

**Response** (key shown only once):
```json
{
  "success": true,
  "rawKey": "ns_FULL_KEY_ONLY_SHOWN_ONCE",
  "apiKey": { "id": "...", "name": "My Integration", "keyPrefix": "ns_abc123" }
}
```

### DELETE /apikeys/:id
Revoke an API key.

### POST /apikeys/:id/rotate
Rotate (regenerate) an API key. Returns new raw key.

---

## Public Versioned API (`/api/v1`)

Requires API key authentication. Documented fully in Swagger at `/api-docs`.

| Method | Path | Description |
|---|---|---|
| POST | `/v1/knowledge/search` | Semantic search |
| POST | `/v1/knowledge/upload` | Upload document |
| GET | `/v1/knowledge/:id` | Get document status |
| POST | `/v1/chat` | Send message |
| POST | `/v1/tools/:toolName` | Run workspace tool |
