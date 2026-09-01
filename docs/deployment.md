# NeuroStack AI — Deployment Guide

## Prerequisites

| Requirement | Minimum |
|---|---|
| Docker | 24+ |
| Docker Compose | v2.20+ |
| RAM | 4 GB |
| Disk | 20 GB |

## Required External Services

Before deploying, provision the following:

| Service | Purpose | Free Tier? |
|---|---|---|
| Google Cloud (Gemini API) | LLM + embeddings | Yes (limited) |
| Pinecone | Vector database | Yes (1 index) |
| MongoDB Atlas (optional) | Managed Mongo | Yes (512 MB) |
| SMTP provider | Email verification | Yes (SendGrid) |

## Quick Start — Development

```bash
# 1. Clone the repo
git clone https://github.com/yourname/neurostack-ai.git
cd neurostack-ai

# 2. Copy and fill env template
cp .env.example .env
# Edit .env with your API keys

# 3. Start all services
docker compose up -d

# 4. Backend runs at http://localhost:5000
# 5. Frontend runs at http://localhost:3000
# 6. API docs at  http://localhost:5000/api-docs
```

## Production Deployment

### Step 1 — Prepare .env.prod

```bash
cat > .env.prod <<EOF
# Secrets
JWT_SECRET=<generate with: openssl rand -hex 64>
MONGO_ROOT_PASSWORD=<strong password>
NEO4J_PASSWORD=<strong password>
REDIS_PASSWORD=<strong password>

# AI Services
GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-2.0-flash
PINECONE_API_KEY=<your key>
PINECONE_INDEX_NAME=neurostack

# App URLs
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api

# Docker Hub
DOCKERHUB_USERNAME=yourdockerusername

# Optional: Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid api key>
SMTP_FROM=noreply@yourdomain.com
REQUIRE_EMAIL_VERIFICATION=true

# Optional: Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF
```

### Step 2 — Build and Push Images

```bash
# Backend
docker build -t yourusername/neurostack-backend:latest ./backend
docker push yourusername/neurostack-backend:latest

# Frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://yourdomain.com/api \
  -t yourusername/neurostack-frontend:latest \
  ./frontend
docker push yourusername/neurostack-frontend:latest
```

### Step 3 — Deploy on Server

```bash
# SSH into your server
ssh user@your-server

# Create app directory
mkdir -p /opt/neurostack
cd /opt/neurostack

# Upload docker-compose.prod.yml and .env.prod
scp docker-compose.prod.yml user@your-server:/opt/neurostack/
scp nginx/ user@your-server:/opt/neurostack/ -r

# Start production stack
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Verify
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend --tail=50
```

### Step 4 — Nginx TLS (Optional)

Place your TLS certificates in `nginx/certs/` and configure `nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location /api/ {
        proxy_pass http://backend:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://frontend:3000/;
        proxy_set_header Host $host;
    }
}
```

## GitHub Actions CI/CD

Set these secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `DEPLOY_HOST` | Production server IP |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | Private SSH key (PEM) |
| `GEMINI_API_KEY` | For E2E tests |
| `PINECONE_API_KEY` | For E2E tests |
| `PINECONE_INDEX_NAME` | For E2E tests |
| `NEXT_PUBLIC_API_URL` | Frontend API URL for build |

The CI pipeline runs on every push to `main` or `develop`. Deployment triggers automatically on `main` after CI passes.

## Health Checks

| Endpoint | Expected |
|---|---|
| `GET /api/health` | `{ "status": "ok" }` |
| `GET /api-docs` | Swagger UI |
| `GET http://localhost:3000` | Next.js frontend |

## Scaling Considerations

- **Worker**: The BullMQ worker service (`worker` in docker-compose) can be scaled horizontally: `docker compose scale worker=3`
- **Backend**: Stateless Express; scale behind Nginx upstream
- **Redis**: Use Redis Sentinel or Redis Cluster for HA
- **MongoDB**: Use Atlas M10+ or a replica set for production
- **Pinecone**: The free tier (1 index, 100K vectors) is sufficient for demos; upgrade to Standard for production workloads
