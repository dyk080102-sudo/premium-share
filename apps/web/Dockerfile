# Stage: deps
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* turbo.json* ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY apps/family-runner/package.json ./apps/family-runner/
COPY packages/domain/package.json ./packages/domain/
RUN npm install --workspaces --include-workspace-root

# Stage: builder
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://psuser:pspassword@db:5432/premiumshare
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

RUN npx prisma generate --schema=packages/domain/prisma/schema.prisma
RUN npm run build --workspace=apps/web

# Stage: runner
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages/domain ./packages/domain

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
