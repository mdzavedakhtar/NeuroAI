# NeuroStack AI

**NeuroStack AI** is a professional, full-stack, RAG (Retrieval-Augmented Generation) powered Document Intelligence Platform. It allows users to securely upload documents—including PDFs, Word documents, Excel sheets, and PowerPoint presentations—and have grounded, real-time conversations with their private knowledge base.

---

## 🚀 Key Features

### 1. Unified Multi-Format Document Processor
*   **PDF Extraction**: Parsed using `pdf-parse` to extract clean page-by-page text.
*   **Word Documents (DOCX)**: Processed using `mammoth` to cleanly extract structured text.
*   **Excel Spreadsheets (XLSX)**: Extracted sheet-by-sheet into CSV format via `xlsx` to maintain row/column structure.
*   **PowerPoint Slides (PPTX)**: Slide-by-slide text extraction utilizing `xlsx` zip-utility parsers.
*   **Smart Chunking**: Text is cleaned, normalized, and broken into chunks of `1000` characters with a `200`-character overlap to preserve semantic context.

### 2. High-Performance RAG Pipeline
*   **Pinecone Vector Database**: Chunks are mapped and synchronized to Pinecone serverless vector indexes.
*   **Integrated Embeddings**: Leveraging Pinecone's target vectorization engines to convert raw text into high-dimensional search embeddings.
*   **Semantic Search**: Custom queries fetch the top `topK` matches (defaulting to 5, range-bound 1-20) relevant to user questions.
*   **Context Grounding**: AI prompts dynamically integrate fetched snippets, forcing Gemini to reply *only* with facts present in the uploaded document.

### 3. Advanced Conversation & Streaming Engine
*   **Standard & Streaming Responses**: Messages can be requested normally or streamed word-by-word using **Server-Sent Events (SSE)** for a fast, responsive chat experience.
*   **Conversation Persistence**: Conversations, individual user messages, and chunk links are stored and tracked in MongoDB.
*   **Dynamic Model Switching**: Flexible mid-chat routing between `gemini-2.5-flash` (fast) and `gemini-2.5-pro` (deep reasoning) models.

### 5. Knowledge Graph Intelligence (Neo4j)
*   **Automatic Entity Extraction**: On document upload, entities (people, organizations, technologies, projects, products, concepts, locations) are extracted and merged into a Neo4j knowledge graph.
*   **Entity Relationships**: Connections such as `WORKS_AT`, `USES`, `CREATED`, `PART_OF`, `COMPETES_WITH` are inferred and stored between entities.
*   **Natural-Language Graph Queries**: The **Graph Explorer** page turns plain questions into graph lookups, returning matched entities, relationship paths, and the source chunks that back each fact.
*   **User-Isolated Namespaces**: Every node and relationship is scoped by `userId` and `documentId`, so each user only ever sees their own graph.
*   **Resilient by Design**: If Neo4j is unreachable the server boots normally and the Graph Explorer surfaces a clear offline message instead of crashing.

### 4. Secure Authentication & User Isolation
*   **Token Security**: Uses JSON Web Tokens (JWT) for secure authentication.
*   **Password Hashing**: Cryptographic protection with `bcryptjs`.
*   **Namespace Isolation**: All documents, chunks, and vector queries are namespace-isolated on a per-user basis.

---

## 🛠️ Technology Stack

### Frontend
*   **Framework**: Next.js 15 (React 19, TypeScript)
*   **Styling**: Tailwind CSS & Vanilla CSS (with PostCSS)
*   **Animations**: Framer Motion & CSS custom keyframes
*   **State & Fetching**: React Hooks, TanStack React Query
*   **Utilities**: `react-markdown` (for rich AI answers), `lucide-react` (icons), `sonner` (toasts)

### Backend
*   **Runtime & Framework**: Node.js & Express.js (TypeScript)
*   **Execution**: Running dynamically using `tsx` (TypeScript Execute)
*   **Databases**: MongoDB (via Mongoose), Pinecone DB & Neo4j (knowledge graph)
*   **Orchestration SDK**: Google Gemini GenAI SDK (`@google/genai` v2.15.0)
*   **Security & Logs**: Helmet, CORS, Cookie Parser, Morgan logging, Multer file upload

---

## 📂 Directory Structure

```text
NeuroStack-AI/
├── backend/
│   ├── src/
│   │   ├── config/          # Database (Mongoose) connection setup
│   │   ├── controllers/     # Auth, Chat, Knowledge, RAG, Search business logic
│   │   ├── middleware/      # Auth protection, Multer upload filters
│   │   ├── models/          # User, Knowledge, KnowledgeChunk, Conversation, Message schemas
│   │   ├── routes/          # API endpoints (Auth, Knowledge/RAG, Chat)
│   │   ├── services/        # Integrations: Pinecone, Gemini, Document-Parsers
│   │   ├── types/           # Custom TypeScript definitions
│   │   └── server.ts        # Main Express server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js Pages (Landing, Login, Register, Dashboard)
│   │   │   └── dashboard/   # Chat workspace, Graph Explorer, Settings
│   │   ├── components/      # Shared components (UI kit, dashboard shell, headers)
│   │   ├── features/        # Modular features (auth, chat, knowledge, graph, settings)
│   │   └── services/        # API client integrations
│   ├── package.json
│   └── next.config.ts
└── README.md                # Project overview and configuration documentation (this file)
```

---

## ⚙️ Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   MongoDB Instance
*   Pinecone Vector DB account & index
*   Google Gemini API Key

### Backend Configuration
1. Navigate to `backend/` and create a `.env` file:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   FRONTEND_URL=http://localhost:3000

   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash

   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_INDEX_NAME=your_pinecone_index_name

   # Neo4j Knowledge Graph (optional — Graph Explorer stays offline when absent)
   NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
   NEO4J_USERNAME=your_neo4j_username
   NEO4J_PASSWORD=your_neo4j_password
   ```
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```

### Frontend Configuration
1. Navigate to `frontend/` and create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```
2. Install dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
3. Run Next.js server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📍 Dashboard Pages

| Route | Purpose |
| --- | --- |
| `/dashboard` | Chat workspace — RAG conversations, PDF attach, document library, export |
| `/dashboard/graph` | Graph Explorer — query entities/relationships extracted from your documents |
| `/dashboard/settings` | Profile & password management |

## 🔬 Verifying Neo4j Connectivity

From `backend/`, run the self-cleaning connectivity script (creates, reads and deletes a test node):

```bash
node test_neo4j_ops.js
```

If it reports `No routing servers available`, your Neo4j AuraDB instance is paused or the credentials in `.env` are incorrect — resume the instance in the Neo4j Aura console and retry. The backend itself tolerates an offline graph and will log `Graph DB features will be offline.`.
