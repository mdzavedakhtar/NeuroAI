# NeuroStack AI — Architecture Overview

## System Overview

NeuroStack AI is a full-stack Generative AI platform built on a Node.js/Express backend and a Next.js frontend. It combines Retrieval-Augmented Generation (RAG) with a knowledge graph to deliver grounded, hallucination-resistant AI answers over user-uploaded documents.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NeuroStack AI                                 │
│                                                                         │
│   ┌──────────────┐     ┌──────────────────────────────────────────────┐ │
│   │   Next.js    │────▶│              Express Backend                 │ │
│   │  Frontend    │◀────│                                              │ │
│   │  (Port 3000) │ JWT │   ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│   └──────────────┘     │   │  Routes  │  │  Serv.   │  │ Middleware│ │ │
│                        │   └────┬─────┘  └────┬─────┘  └──────────┘  │ │
│                        │        │              │                       │ │
│                        └────────┼──────────────┼───────────────────────┘ │
│                                 │              │                          │
│            ┌────────────────────▼──────────────▼──────────────────────┐  │
│            │                 Data Layer                                │  │
│            │                                                           │  │
│            │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │  │
│            │   │ MongoDB  │  │ Pinecone │  │  Neo4j   │  │ Redis  │  │  │
│            │   │(metadata)│  │(vectors) │  │  (graph) │  │(queue) │  │  │
│            │   └──────────┘  └──────────┘  └──────────┘  └────────┘  │  │
│            └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15, React 19, TypeScript | UI, routing, SSR |
| Backend | Node.js 20, Express, TypeScript | API, business logic |
| AI / LLM | Google Gemini (via @google/genai) | Text generation, embeddings |
| Vector DB | Pinecone | Semantic similarity search |
| Graph DB | Neo4j | Entity relationship storage |
| Document DB | MongoDB + Mongoose | Users, conversations, metadata |
| Job Queue | BullMQ + Redis | Async ingestion pipeline |
| Auth | JWT + bcrypt + API Keys | Dual authentication system |

## Key Features

### 1. RAG Pipeline
Documents are chunked, embedded via Gemini, stored in Pinecone, and retrieved at query time to ground AI responses.

### 2. Knowledge Graph
During ingestion, Neo4j entities (People, Organizations, Concepts, Documents) and their relationships are extracted via LLM and persisted. The Graph Explorer allows interactive browsing.

### 3. 10-in-1 AI Workspace
Modular tool architecture (`/api/tools/:toolName`) exposes tools including: Document Summarizer, Smart RAG Search, Bug Detector, Test Generator, Data Analyzer, Content Rewriter, Translator, Email Composer, Code Explainer, and Knowledge Graph Query.

### 4. Developer Platform
- API key management with SHA-256 hashing (keys shown only once)
- Versioned public API `/api/v1/*`
- Swagger UI at `/api-docs`
- Per-user usage tracking and plan enforcement

### 5. Multi-Source Ingestion
- **File Upload**: PDF, DOCX, XLSX, PPTX (50 MB limit, magic byte validation)
- **Web URL**: SSRF-safe scraping with DNS resolution checks
- **GitHub Repositories**: Source file bundling, excluding binaries/secrets/lockfiles

### 6. Analytics Dashboard
Real-time aggregates from MongoDB: document counts, query volumes, feedback scores, token usage, model distribution, response latency histograms, and topic cloud.

## Directory Structure

```
neurostack-ai/
├── backend/
│   └── src/
│       ├── config/          # DB connections, Swagger, plan config
│       ├── controllers/     # Route handlers
│       ├── middleware/       # Auth, limits, upload, rate limit
│       ├── models/          # Mongoose schemas
│       ├── routes/          # Express router files
│       ├── services/        # Business logic, AI, scraping
│       │   ├── llm/         # LLM provider abstractions
│       │   └── tools/       # 10 modular workspace tools
│       ├── workers/         # BullMQ worker processes
│       └── server.ts        # Express app entry point
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       │   └── dashboard/   # Protected dashboard pages
│       ├── features/        # Domain feature modules
│       │   ├── auth/
│       │   ├── chat/
│       │   ├── knowledge/
│       │   └── graph/
│       ├── components/      # Shared UI components
│       └── services/        # API fetch utilities
├── docs/                    # This documentation
├── .github/workflows/       # CI/CD pipelines
├── docker-compose.yml       # Development stack
└── docker-compose.prod.yml  # Production stack
```
