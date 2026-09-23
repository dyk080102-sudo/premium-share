FROM node:20-alpine
RUN apk add --no-cache python3 make g++ libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* turbo.json* ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY apps/family-runner/package.json ./apps/family-runner/
COPY packages/domain/package.json ./packages/domain/
RUN npm install --workspaces --include-workspace-root

COPY . .
ENV DATABASE_URL=postgresql://psuser:pspassword@db:5432/premiumshare
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN npx prisma generate --schema=packages/domain/prisma/schema.prisma

CMD ["npx", "tsx", "apps/worker/src/index.ts"]
