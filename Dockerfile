# Multi-stage Dockerfile for ass.man Engine
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HTTPS_PORT=3101

# Copy built artifacts and production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/schemas ./schemas
COPY --from=builder /app/views ./views
COPY --from=builder /app/data ./data
COPY --from=builder /app/app-config.json ./app-config.json

# Declare persistence volumes for custom schemas, views, and data
VOLUME ["/app/schemas", "/app/views", "/app/data"]

EXPOSE 3100 3101

CMD ["node", "dist/server.cjs"]
