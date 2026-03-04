# LA VAGUE - Production Dockerfile
# Multi-stage build for optimized production image

# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:20-alpine AS dependencies

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# ==========================================
# Stage 2: Build
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application (if needed)
# RUN npm run build

# Remove devDependencies for production
RUN npm prune --production

# ==========================================
# Stage 3: Production
# ==========================================
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --from=builder /app/server.js ./
COPY --from=builder /app/products.js ./
COPY --from=builder /app/cart.js ./
COPY --from=builder /app/utils.js ./
COPY --from=builder /app/translations.js ./
COPY --from=builder /app/i18n.js ./
COPY --from=builder /app/page.js ./
COPY --from=builder /app/home.js ./
COPY --from=builder /app/shop.js ./
COPY --from=builder /app/product.js ./
COPY --from=builder /app/checkout.js ./
COPY --from=builder /app/checkout-api.js ./
COPY --from=builder /app/admin.js ./
COPY --from=builder /app/script.js ./
COPY --from=builder /app/sw.js ./
COPY --from=builder /app/site.webmanifest ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/email-templates ./email-templates
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/*.html ./
COPY --from=builder /app/*.css ./
COPY --from=builder /app/*.png ./
COPY --from=builder /app/*.svg ./

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
