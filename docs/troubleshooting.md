# NeuroStack AI — Troubleshooting Guide

## Common Issues

### Backend won't start

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:27017`

**Fix**: MongoDB is not running. Start it:
```bash
docker compose up -d mongodb
# or locally:
mongod --dbpath ./data
```

---

**Symptom**: `Error: PINECONE_API_KEY is not set`

**Fix**: Copy `.env.example` to `.env` and fill in your Pinecone credentials. The backend will crash on startup if required env variables are missing.

---

**Symptom**: `Neo4j connection error: could not connect to bolt://localhost:7687`

**Fix**: Neo4j is not running. Start it:
```bash
docker compose up -d neo4j
```
Wait ~30 seconds for Neo4j to fully initialize.

---

### Document ingestion stuck at "processing"

**Symptom**: Document status never advances past `processing` or `vector_indexing`.

**Diagnosis**:
```bash
# Check worker logs
docker compose logs worker --tail=100

# Check Redis queue
docker compose exec redis redis-cli KEYS "bull:*"
```

**Common causes**:
- Worker service crashed or not running
- Pinecone upsert quota exceeded
- Gemini API key invalid or quota exhausted
- File was uploaded but `/api/knowledge/:id/index` was never called

---

### "Failed to scrape URL" error

**Possible causes**:

| Error message | Cause | Fix |
|---|---|---|
| `SSRF violation: private IP` | URL resolves to a private/loopback address | Use a public URL only |
| `Request timed out` | The page took > 10s to respond | Try a different URL |
| `Content too large` | Page exceeds 500 KB text limit | Try a more specific page |
| `Non-HTML content type` | URL returned PDF/image/video | Use the file upload tab instead |

---

### "Index Repository" fails for GitHub

**Possible causes**:

| Symptom | Fix |
|---|---|
| `404 Not Found` | Repository is private — provide a Personal Access Token |
| `403 rate limited` | GitHub API rate limit hit — add a PAT even for public repos |
| `Repository too large` | Reduce scope by using a specific branch URL |
| `No supported files found` | Repo contains only binaries or unsupported file types |

---

### Frontend authentication loop

**Symptom**: Redirected to login page endlessly after logging in.

**Fix**: Clear localStorage in the browser:
```javascript
localStorage.clear()
```
Then log in again. This can happen if the JWT secret changed server-side after the token was issued.

---

### Swagger UI shows no routes

**Symptom**: `GET /api-docs` shows an empty spec.

**Fix**: The backend must be started with `NODE_ENV` not set to `test`. Swagger is only initialized in `development` and `production` modes.

---

### API key authentication returns 401

**Symptom**: `X-API-Key: ns_xxxx` returns `Invalid or revoked API key`.

**Checks**:
1. Ensure you're using the **full raw key** (shown once at creation), not the masked `ns_****` display version.
2. Verify the key has not been revoked via the Developer Console.
3. Confirm the key prefix (`ns_xxxxxxxx`) matches a stored record — keys older than rotation are permanently invalidated.

---

## Debugging Tips

### Enable verbose logging

Set `LOG_LEVEL=debug` in your `.env` to get detailed request and service logs.

### Inspect the ingestion queue

```bash
# Via Redis CLI
docker compose exec redis redis-cli
> LLEN bull:ingestion:wait
> LLEN bull:ingestion:failed
```

### Check database state

```bash
# MongoDB: count knowledge documents by status
docker compose exec mongodb mongosh neurostack --eval "
  db.knowledge.aggregate([
    { \$group: { _id: '\$status', count: { \$sum: 1 } } }
  ]).toArray()
"
```

```cypher
// Neo4j: check entity counts
MATCH (n) RETURN labels(n) AS label, count(n) AS count
```
