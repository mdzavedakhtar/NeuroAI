# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 neurostack

# Copy only production artifacts
COPY --from=builder --chown=neurostack:nodejs /app/dist ./dist
COPY --from=builder --chown=neurostack:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=neurostack:nodejs /app/package.json ./package.json

# Create uploads directory with correct ownership
RUN mkdir -p uploads && chown neurostack:nodejs uploads

USER neurostack

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
