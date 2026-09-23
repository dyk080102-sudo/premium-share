FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package.json package-lock.json* turbo.json* ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY apps/family-runner/package.json ./apps/family-runner/
COPY packages/domain/package.json ./packages/domain/
RUN npm install --workspaces --include-workspace-root

COPY . .
ENV DATABASE_URL=postgresql://psuser:pspassword@db:5432/premiumshare
ENV PRISMA_CLI_BINARY_TARGETS=native
RUN npx prisma generate --schema=packages/domain/prisma/schema.prisma

ENV FAMILY_AUTOMATION_MODE=DEMO
ENV AUTHORIZED_BROWSER_ENABLED=false
ENV MOCK_FAMILY_ADMIN_URL=http://mock-family-admin:3100
ENV FAMILY_RUNNER_ID=family-runner-1

CMD ["npx", "tsx", "apps/family-runner/src/index.ts"]
