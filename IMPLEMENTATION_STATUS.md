# IMPLEMENTATION STATUS

_Updated: 2026-09-23_

## ✅ 완료된 구현

### 가족 자동화 (2026-09-23)
- [x] Prisma Family* 모델/enum + migration `20260923000000_family_automation`
- [x] Domain: capacity / gate / job / sync / invite / removal / sheets
- [x] `apps/family-runner` DEMO Playwright + ASSISTED 안내 + AUTHORIZED 잠금
- [x] Mock Family Admin (`:3100`) role/label 기반 UI
- [x] Admin `/admin/family` + API (settings/jobs/inspect/invite/remove/pause/emergency/retry/assisted)
- [x] docs: FAMILY_AUTOMATION / REAL_CONNECTION_CHECKLIST / SUPPORT_SCOPE
- [x] 단위 테스트 `tests/unit/family-capacity.test.ts`
- [x] 통합 테스트 `tests/integration/family-demo.test.ts` (DB 없으면 soft-skip)

**명시:** 실 Google/YouTube UI 연동 **미검증**. AUTHORIZED_BROWSER **잠금**.

### 1단계: 프로젝트 구조
- [x] 모노레포 구성 (`apps/web`, `apps/worker`, `packages/domain`)
- [x] `docker-compose.yml` (db, maildev, web, worker, migration 서비스)
- [x] `.env.example` / `.env`
- [x] `package.json` (workspace 설정, 올바른 스크립트)
- [x] `vitest.config.ts` (단위/통합 테스트 분리)

### 2단계: Prisma 스키마
- [x] 전체 스키마 구현 완료 (30개 이상 모델)
- [x] `packages/domain/prisma/schema.prisma` 완성
- [x] 마이그레이션 SQL 작성 (`migrations/20240101000000_init/migration.sql`)
- [x] Prisma Client 생성 완료 (`npx prisma generate` 성공)

### 3단계: 인증 시스템
- [x] Argon2id 비밀번호 해시 (`argon2` 패키지)
- [x] 세션 생성 및 검증 (Session 테이블)
- [x] HttpOnly 쿠키 (SameSite=Lax)
- [x] 비밀번호 재설정 토큰 (해시 저장, 1시간 만료)
- [x] 로그인 실패 횟수 제한 (5회 초과 후 15분 잠금)
- [x] 권한 헬퍼 함수 (`requireAuth`, `requireRole`)

### 4단계: 도메인 서비스 (`packages/domain/src/services/`)
- [x] `OrderService` - 주문 생성/취소/만료
- [x] `PaymentService` - 결제 확인, DEMO 시뮬레이션, CSV 매칭
- [x] `AllocationService` - 슬롯 배정 (SELECT FOR UPDATE SKIP LOCKED)
- [x] `InvitationService` - 초대 발송/기록/활성화/회수
- [x] `SubscriptionService` - 갱신, 만료 처리, 회수 작업 생성
- [x] `RefundService` - 환불 요청/승인/지급 (초과 환불 방지)
- [x] `NotificationService` - 알림 생성, Outbox 관리
- [x] `AuditService` - 감사 로그

### 5단계: Next.js App Router
**공개 페이지:**
- [x] `/` - 홈 (한국어, 서비스 소개)
- [x] `/products` - 상품 목록
- [x] `/products/[id]` - 상품 상세 + 요금제 선택
- [x] `/auth/login` - 로그인
- [x] `/auth/register` - 회원가입
- [x] `/auth/reset-password` - 비밀번호 재설정 (요청/확인 통합)
- [x] `/faq` - 자주 묻는 질문

**회원 전용 페이지:**
- [x] `/dashboard` - 대시보드 (활성 구독, 최근 주문, 미읽은 알림)
- [x] `/orders` - 주문 목록
- [x] `/orders/[id]` - 주문 상세 (결제 안내 포함)
- [x] `/subscriptions` - 구독 목록
- [x] `/subscriptions/[id]` - 구독 상세 (슬롯/초대 현황)
- [x] `/refunds` - 환불 목록
- [x] `/refunds/[id]` - 환불 상세
- [x] `/notifications` - 알림 목록
- [x] `/tickets` - 문의 목록
- [x] `/tickets/new` - 문의 작성
- [x] `/tickets/[id]` - 문의 상세 (메시지 스레드)
- [x] `/profile` - 프로필 (비밀번호 변경 포함)

**관리자 페이지:**
- [x] `/admin` - 대시보드 (통계 요약)
- [x] `/admin/products` - 상품 관리
- [x] `/admin/orders` - 주문 관리 (상태별 필터, 페이지네이션)
- [x] `/admin/subscriptions` - 구독 관리
- [x] `/admin/refunds` - 환불 관리
- [x] `/admin/members` - 회원 관리 (이메일 검색, 역할 필터)
- [x] `/admin/groups` - 그룹 관리 (슬롯 현황)
- [x] `/admin/invitations` - 초대 관리 (발송/활성화 버튼)
- [x] `/admin/bank-import` - 입금 내역 (CSV 업로드, 미매칭 목록)
- [x] `/admin/settings` - 시스템 설정
- [x] `/admin/audit-logs` - 감사 로그 (필터 검색)
- [x] `/admin/jobs` - 작업 이력
- [x] `/admin/family` - 가족 자동화 목록/상세 (DEMO · ASSISTED · AUTHORIZED 잠금)

### 6단계: API Routes (총 43개 + 가족 자동화)
**인증:**
- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/logout`
- [x] `POST /api/auth/reset-password/request`
- [x] `POST /api/auth/reset-password/confirm`
- [x] `PATCH /api/auth/password`

**회원:**
- [x] `GET|POST /api/orders`
- [x] `GET|DELETE /api/orders/[id]`
- [x] `POST /api/orders/[id]/payment/bank-transfer`
- [x] `POST /api/demo/payment/simulate`
- [x] `GET /api/subscriptions`
- [x] `GET /api/subscriptions/[id]`
- [x] `POST /api/subscriptions/[id]/renewal`
- [x] `GET|POST /api/refunds`
- [x] `GET /api/refunds/[id]`
- [x] `GET /api/notifications`
- [x] `POST /api/notifications/[id]/read`
- [x] `POST /api/notifications/read-all`
- [x] `GET|POST /api/tickets`
- [x] `GET /api/tickets/[id]`
- [x] `POST /api/tickets/[id]/messages`
- [x] `GET /api/products`
- [x] `GET /api/products/[id]`

**관리자:**
- [x] `GET /api/admin/dashboard`
- [x] `GET /api/admin/members`
- [x] `GET|PATCH /api/admin/members/[id]`
- [x] `GET /api/admin/payments`
- [x] `POST /api/admin/payments/[id]/confirm`
- [x] `GET /api/admin/allocations`
- [x] `POST /api/admin/invitations/[id]/record-sent`
- [x] `POST /api/admin/invitations/[id]/confirm-activation`
- [x] `POST /api/admin/invitations/[id]/confirm-reclaim`
- [x] `POST /api/admin/refunds/[id]/approve`
- [x] `POST /api/admin/refunds/[id]/complete-payout`
- [x] `GET|POST /api/admin/products`
- [x] `GET|PATCH /api/admin/products/[id]`
- [x] `GET|POST /api/admin/groups`
- [x] `GET|PATCH /api/admin/groups/[id]`
- [x] `GET|POST /api/admin/bank-import`
- [x] `GET|POST /api/admin/faq`
- [x] `PATCH|DELETE /api/admin/faq/[id]`
- [x] `GET|POST /api/admin/settings`
- [x] `GET /api/admin/audit-logs`
- [x] `GET /api/admin/jobs`
- [x] Family automation admin APIs: settings, jobs, inspect, enqueue-invite, enqueue-remove, pause, emergency-stop, retry, switch-assisted

### 7단계: Worker 프로세스
- [x] `apps/worker/src/index.ts` 완성
- [x] node-cron 6개 스케줄 작업:
  - 미발송 주문 만료 (5분마다)
  - 대기열 처리 (실시간)
  - 만료 처리 (실시간)
  - 구독 알림 (일별)
  - Outbox 이메일 발송 (분단위)
  - 잠금 해제 (10분마다)
- [x] JobExecution 멱등성 키
- [x] 중복 실행 방지 (lockedAt)

### 8단계: Seed 파일
- [x] 5개 계정 (SUPER_ADMIN, OPERATOR, SUPPORT, MEMBER x2)
- [x] 4개 가상 상품
- [x] 3개 그룹, 슬롯 구성
- [x] 시나리오 데이터 (가입 대기, 초대 발송, 활성, 갱신 임박, 환불 진행)
- [x] FAQ 5개, 공지 1개, 설정 6개
- [x] Idempotent (upsert 기반)

### 9단계: 테스트
- [x] Vitest 단위 테스트 (`tests/unit/refund.test.ts`, `tests/unit/family-capacity.test.ts`)
- [x] 통합 테스트 (`tests/integration/allocation.test.ts`, `tests/integration/family-demo.test.ts`) — DB 없으면 SKIP/부분 실행
- [x] Playwright E2E (`apps/web/e2e`, `apps/family-runner/e2e/demo-family.spec.ts` — mock admin)

---

## 가족 자동화 (2026-09-23 추가)

- [x] Prisma Family* 모델 + migration `20260923000000_family_automation`
- [x] Domain: capacity / gate / job / sync / invite / removal / sheets
- [x] `apps/family-runner` DEMO Playwright · ASSISTED 안내 · AUTHORIZED 잠금
- [x] mock-family-admin :3100
- [x] docs: FAMILY_AUTOMATION.md, FAMILY_REAL_CONNECTION_CHECKLIST.md, FAMILY_SUPPORT_SCOPE.md, FAMILY_SESSION_PROTECTION.md, FAMILY_ERROR_RECOVERY.md, FAMILY_VERIFICATION_REPORT.md
- [ ] **실 Google/YouTube UI 연동: 미검증 · 미수행**
- [x] AUTHORIZED_BROWSER: 기본 잠금 (`AUTHORIZED_BROWSER_ENABLED=false`)
- [x] migration `20260923000000_family_automation` 적용 (premiumshare + premiumshare_test)
- [x] seed: DEMO FamilyAutomationSetting + 비공식 허가 명시 consent

---

## ⚠️ 부분 완료 / 환경 제약

### AUTHORIZED_BROWSER / 실연동
- **상태**: 드라이버 잠금 구현. 실 UI 셀렉터·실계정 로그인 미검증.
- **보고**: “로컬 DEMO 통과 = 실 YouTube 정상”이라고 주장하지 않음.

### docker compose family 서비스
- `mock-family-admin` / `family-runner` 정의됨. Windows에서 alpine+host `node_modules` 마운트는 네이티브 바이너리 이슈 가능 → 로컬 `npm run dev:mock-family` / `dev:family-runner` 권장.

---

## 🔧 미구현 항목 (솔직 보고)

| 항목 | 사유 |
|------|------|
| HTML 이메일 템플릿 | 현재 텍스트 기반, 렌더링은 작동 |
| 파일 첨부 API | Ticket 첨부 파일 업로드 미구현 |
| 실 결제 PG (Toss/Nice 등) | `PaymentProvider` 스텁만 준비. MANUAL 무통장으로 운영 |
| 실 Google/YouTube Family UI 연동 | **미검증**. AUTHORIZED_BROWSER 잠금. DEMO mock만 자동 클릭 |

### 2026-09-24 Production conversion
- [x] `BUSINESS_MODE` 기본 MANUAL · Docker/ENV 반영
- [x] 정적 localStorage 데모 → `demos/static-github-pages/`
- [x] Payment depositorName/provider/externalId + PG enum
- [x] `PaymentProvider` 스텁 + `/api/payments/webhook` 501
- [x] 입금 신고 페이지 `/orders/[id]/payment` + 계좌 AppSetting 연동
- [x] 비밀번호 변경/재설정 필드 불일치 수정
- [x] CSRF Origin · CSP · rate limit · Toast
- [x] Waitlist API + `/waitlist` 회원 페이지

_이전에 미구현으로 보고된 `admin/bank-import/[id]`, `admin/refunds/[id]`는 2026-09-23에 추가 완료됨._
_웨이팅리스트 UI/API는 2026-09-24에 추가됨._

---

## 최종 빌드 상태 (가족 자동화 포함, 2026-09-23)

```
✅ Prisma migrate family_automation: premiumshare + test DB
✅ Seed: Family DEMO settings
✅ Vitest 단위: 15/15 (family-capacity 6 + refund 9)
✅ Vitest 통합: 5/5 (family-demo 3 + allocation 2)
✅ AUTHORIZED_BROWSER: 잠금 (가짜 성공 없음)
⬜ 실 Google/YouTube Family UI: 미검증
```
