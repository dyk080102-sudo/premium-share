# Production Conversion Notes

_Updated: 2026-09-24_

## Stack (Production)

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 (App Router) — `apps/web` |
| Backend | Next.js API Routes + domain services (`packages/domain`) |
| Database | PostgreSQL + Prisma |
| Auth | Cookie session (`ps_session`, Argon2id, RBAC) |
| Payment | MANUAL bank transfer now; `PaymentProvider` stub for future PG |
| Worker | `apps/worker` / unified server (outbox, expiry, waitlist) |

## Defaults

- `BUSINESS_MODE=MANUAL` (DEMO simulate disabled with HTTP 405)
- `PAYMENT_PROVIDER=manual`
- Static localStorage demo archived under `demos/static-github-pages/`

## Payment (deferred PG)

- Interface: `packages/domain/src/services/payment-provider.ts`
- Webhook stub: `POST /api/payments/webhook` → 501 until implemented
- Live path: bank transfer report → admin confirm → allocation

## Security

- HttpOnly + SameSite=Lax session cookie
- Origin CSRF checks on mutating auth/payment routes + middleware
- zod validation on APIs
- CSP / X-Frame-Options / nosniff headers
- Login/register IP rate limits (in-process)
- Admin RBAC via `requireRole` + admin layout

## Required env

See `.env.example`. Minimum for go-live:

```
DATABASE_URL=...
NEXTAUTH_URL=https://your.domain
APP_URL=https://your.domain
NEXTAUTH_SECRET=<32+ chars>
BUSINESS_MODE=MANUAL
PAYMENT_PROVIDER=manual
SMTP_HOST=...
SMTP_PORT=...
SMTP_FROM=...
```

## Verification (2026-09-24)

Against local PostgreSQL with `BUSINESS_MODE=MANUAL`:

```
npm run db:migrate && npm run db:seed
npm run verify:manual   # Order → ManualBankPaymentProvider → admin confirmPayment
```

HTTP checks (Next.js :3000):

| Check | Result |
|-------|--------|
| Login (member/admin) | 200 success |
| Create order | `source: MANUAL` |
| `POST /api/demo/payment/simulate` | **405** |
| Bank transfer report | PENDING + depositorName |
| Admin confirm payment | CONFIRMED |
| Member → `/api/admin/dashboard` | **403** |
| Unauthenticated `/admin` | **307** → login |
| `POST /api/payments/webhook` | **501** PG stub |
| `/waitlist` | 200 |

Unit tests: 15/15. `npm run typecheck` clean.
