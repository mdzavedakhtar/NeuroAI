# NeuroStack AI — Data Flow

## 1. User Authentication Flow

```
Client ──POST /api/auth/login──▶ auth.controller
                                      │
                                      ├─ Find user in MongoDB
                                      ├─ bcrypt.compare(password, hash)
                                      └─ Sign JWT (7d expiry)
                                           │
Client ◀──{ token, user }────────────────┘

Subsequent requests: Authorization: Bearer <token>
auth.middleware.ts decodes token → req.user
```

## 2. Document Ingestion Pipeline

```
Client ──POST /api/knowledge/upload──▶ knowledge.controller
                                            │
                                     Multer saves file to uploads/
                                     Magic byte validation
                                     MongoDB Knowledge record (status: uploaded)
                                            │
                                            ▼
                                    ──POST /api/knowledge/:id/index──▶
                                            │
                                     ingestionQueue.add(job)
                                            │
                                   [BullMQ Worker picks up job]
                                            │
                               ingestion.orchestrator.ts
                                       ┌───┴────────────────┐
                                       ▼                    ▼
                              Parse document          Update status
                              (pdf-parse / xlsx /     → "parsing"
                               mammoth / pptx)
                                       │
                                  Chunk text (800 token chunks, 200 overlap)
                                       │
                              ┌────────┴──────────────────┐
                              ▼                           ▼
                    Embed via Gemini              Update status
                    textEmbedding004              → "vector_indexing"
                              │
                    Upsert to Pinecone
                    (namespace=userId)
                              │
                    Extract entities via LLM      Update status
                    → Upsert to Neo4j             → "graph_indexing"
                              │
                    Mark Knowledge status         Update status
                    → "ready"                     → "ready"
```

## 3. RAG Chat Query Flow

```
Client ──POST /api/chat/:conversationId/messages──▶ chat.controller
                                                          │
                                              Build memory context
                                              (last N messages from MongoDB)
                                                          │
                                              Embed user question
                                              via Gemini embeddings
                                                          │
                                              Pinecone similarity search
                                              (topK=5, namespace=userId)
                                                          │
                                              Build context string
                                              from retrieved chunks
                                                          │
                                              generateRagAnswer()
                                              (Gemini Pro with system prompt)
                                                          │
                                              Stream / return answer
                                                          │
                                              Save to Message collection
                                              with source citations
                                                          │
Client ◀──{ answer, sources[] }──────────────────────────┘
```

## 4. Knowledge Graph Query Flow

```
Client ──POST /api/graph/query──▶ graph.controller
                                        │
                                  Neo4j Cypher query
                                  (keyword / entity search)
                                        │
                                  Return nodes + relationships
                                  with source document metadata
                                        │
Client ◀──{ nodes[], edges[] }─────────┘

Client ──GET /api/graph/explorer──▶ SVG interactive visualizer
                                        │
                                  D3-style spring physics layout
                                  rendered as React state SVG
                                  with zoom / pan / node selection
```

## 5. Web URL Ingestion Flow

```
Client ──POST /api/knowledge/url──▶ url.routes
                                        │
                                  DNS.lookup(hostname)
                                  Check: not loopback / private subnet
                                  (SSRF protection)
                                        │
                                  fetch(url, AbortController 10s)
                                  Strip HTML → plain text
                                  Truncate to 500KB
                                        │
                                  Save as .txt under uploads/
                                  Create MongoDB Knowledge record
                                  ingestionQueue.add(job)
                                        │
                                  [Same BullMQ pipeline as file upload]
```

## 6. GitHub Repository Ingestion Flow

```
Client ──POST /api/knowledge/github──▶ github.routes
                                             │
                                    GET https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD
                                    Filter file tree:
                                      - Only text source files
                                      - Exclude: node_modules, .env, *.pem,
                                                 package-lock, yarn.lock,
                                                 binaries, images
                                             │
                                    Batch download file contents
                                    Bundle all into structured .txt
                                    Save under uploads/
                                    Create MongoDB Knowledge record
                                    ingestionQueue.add(job)
                                             │
                                    [Same BullMQ pipeline as file upload]
```

## 7. API Key Authentication Flow

```
External Client ──X-API-Key: ns_xxxxxx──▶ auth.middleware
                                                │
                                        Extract prefix (ns_xxxxx[0:8])
                                        Find ApiKey record by prefix
                                        SHA-256 hash raw key
                                        Compare with stored hash
                                        Check: not revoked, not expired
                                                │
                                        Load linked User → req.user
                                                │
                                        ──Continue to route handler──▶
```
