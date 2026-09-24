# PremiumShare

**한국어 구독 슬롯 관리 플랫폼** — PostgreSQL 기반 상용(Production) 스택.

> 정적 localStorage 데모는 `demos/static-github-pages/`로 이관되었습니다.  
> 상세: [`docs/PRODUCTION.md`](docs/PRODUCTION.md)

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router) — `apps/web` |
| Backend | Next.js API Routes + `packages/domain` 서비스 |
| Database | PostgreSQL + Prisma |
| Auth | Cookie 세션 (`ps_session`) + Argon2id + RBAC |
| Payment | 무통장(MANUAL) · PG는 `PaymentProvider` 스텁만 준비 |

---

## 빠른 시작

### 1. 환경변수 설정

```bash
cp .env.example .env
# DATABASE_URL, NEXTAUTH_SECRET(≥32자), BUSINESS_MODE=MANUAL 확인
```

### 2. Docker로 실행 (권장)

```bash
docker compose up --build
```

서비스:
- **웹 앱**: http://localhost:3000
- **관리자 패널**: http://localhost:3000/admin
- **MailDev** (이메일 확인): http://localhost:1080

### 3. 로컬 개발 (DB 별도 필요)

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:unified   # 웹 + 워커 (권장)
```

---

## 시드(부트스트랩) 계정

운영 전 **비밀번호를 반드시 변경**하세요.

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 최고 관리자 | admin@premiumshare.demo | Admin1234! |
| 운영자 | operator@premiumshare.demo | Oper1234! |
| 서포트 | support@premiumshare.demo | Supp1234! |
| 일반 회원 1 | member1@premiumshare.demo | Member1234! |
| 일반 회원 2 | member2@premiumshare.demo | Member1234! |

---

## 환경변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 연결 URL | - |
| `NEXTAUTH_SECRET` / `SESSION_SECRET` | 세션·서명용 시크릿 (최소 32자) | - |
| `NEXTAUTH_URL` / `APP_URL` | 앱 공개 URL (CSRF Origin 검증) | `http://localhost:3000` |
| `BUSINESS_MODE` | `MANUAL`(상용) 또는 `DEMO`(시뮬) | `MANUAL` |
| `PAYMENT_PROVIDER` | `manual` \| `demo` \| `pg`(미구현 스텁) | `manual` |
| `SMTP_*` | 이메일 발송 | MailDev 로컬 기본값 |
| `NODE_ENV` | `development` / `production` | `development` |

---

## 비즈니스 / 결제 모드

### MANUAL (기본 · 상용)
- 무통장 입금 → 입금 신고 → 관리자 확인
- `POST /api/demo/payment/simulate` → **405**
- 향후 PG: `PaymentProvider` 구현 후 `PAYMENT_PROVIDER=pg`

### DEMO (로컬 시연 전용)
- `POST /api/demo/payment/simulate` 로 가상 결제
- 상용 배포에서는 사용하지 마세요

---

## 스크립트

```bash
npm run dev                # 웹앱만
npm run dev:unified        # 웹 + 워커 + 패밀리 러너 (권장)
npm run start:unified      # 통합 서버 프로덕션 실행
npm run build              # 웹앱 프로덕션 빌드
npm run db:generate        # Prisma Client 생성
npm run db:migrate         # 마이그레이션 적용
npm run db:seed            # Seed 데이터
npm run test:unit
npm run typecheck
```

---

## 주요 디렉터리

```
apps/web/                 # Next.js 상용 앱
apps/worker/              # 백그라운드 잡
packages/domain/          # Prisma 스키마 + 도메인 서비스
demos/static-github-pages/# 아카이브된 localStorage 데모
docs/PRODUCTION.md        # 상용 전환 노트
```
