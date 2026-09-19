# LA VAGUE API - Production Dockerfile

# Build native runtime dependencies in a disposable stage.
FROM node:20-bookworm-slim AS dependencies

ENV NODE_ENV=production \
    CI=true

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY scripts/setup-husky.js ./scripts/setup-husky.js

RUN npm ci --omit=dev \
    && npm cache clean --force

# Runtime stays slim: no compiler toolchain is shipped to production.
FROM node:20-bookworm-slim AS production

ENV NODE_ENV=production \
    PORT=3000 \
    CI=true

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server.js ./server.js
COPY src ./src
COPY email-templates ./email-templates

RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --create-home nodejs \
    && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
