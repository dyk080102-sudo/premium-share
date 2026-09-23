# PremiumShare

**한국어 구독 슬롯 관리 플랫폼** - 프리미엄 구독 서비스를 그룹으로 공유하여 비용을 절약하는 B2C 플랫폼.

---

## 빠른 시작

### 1. 환경변수 설정

```bash
cp .env.example .env
# .env 파일 편집 (DATABASE_URL, NEXTAUTH_SECRET 등)
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
# 의존성 설치
npm install

# Prisma Client 생성
npm run db:generate

# DB 마이그레이션
npm run db:migrate

# Seed 데이터 적재
npm run db:seed

# 개발 서버 시작
npm run dev
```

---

## 데모 계정

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
| `NEXTAUTH_SECRET` | 세션 서명 키 (최소 32자) | - |
| `BUSINESS_MODE` | `DEMO` 또는 `MANUAL` | `DEMO` |
| `NODE_ENV` | `development` 또는 `production` | `development` |
| `SMTP_HOST` | SMTP 서버 호스트 | `localhost` |
| `SMTP_PORT` | SMTP 포트 | `1025` |
| `SMTP_USER` | SMTP 사용자 | - |
| `SMTP_PASS` | SMTP 비밀번호 | - |
| `SMTP_FROM` | 발신자 이메일 | `noreply@premiumshare.kr` |
| `SKIP_INTEGRATION` | 통합 테스트 건너뜀 (`1`=건너뜀) | `0` |

---

## 비즈니스 모드

### DEMO 모드 (`BUSINESS_MODE=DEMO`)
- `POST /api/demo/payment/simulate` 로 가상 결제 즉시 완료
- DEMO 환불 자동 완료
- 실제 결제 없이 전체 플로우 테스트 가능

### MANUAL 모드 (`BUSINESS_MODE=MANUAL`)
- 입금 확인 후 관리자가 수동으로 결제 확인
- DEMO API 엔드포인트 비활성화 (405 반환)

---

## 스크립트

```bash
# 개발
npm run dev                # 웹앱만
npm run dev:unified        # 웹 + 워커 + 패밀리 러너 (권장)
npm run start:unified      # 통합 서버 프로덕션 실행
npm run dev:worker         # Worker만 별도 실행

# 빌드
npm run build              # 웹앱 프로덕션 빌드

# 데이터베이스
npm run db:generate        # Prisma Client 생성
npm run db:migrate         # DB 마이그레이션 적용
npm run db:migrate:dev     # 개발 마이그레이션 (새 마이그레이션 생성)
npm run db:seed            # Seed 데이터 적재
npm run db:studio          # Prisma Studio 실행

# 테스트
npm run test:unit          # 단위 테스트만 (DB 불필요)
npm run test:integration   # 통합 테스트 (DB 필요)
npm run test:e2e           # E2E 테스트 (실행 서버 필요)

# 품질
npm run typecheck          # TypeScript 타입 검사
npm run lint               # ESLint 실행
```

---

## 아키텍처

```
premium-share/
├── apps/
│   ├── web/                # Next.js 14 App Router
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (public)/    # 공개 페이지
│   │   │   │   ├── (member)/    # 회원 전용 페이지
│   │   │   │   ├── admin/       # 관리자 페이지
│   │   │   │   └── api/         # API Routes
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── ...
│   └── worker/             # Background Worker (node-cron)
└── packages/
    └── domain/             # 도메인 서비스
        ├── prisma/
        │   ├── schema.prisma
        │   ├── seed.ts
        │   └── migrations/
        └── src/
            └── services/   # OrderService, PaymentService, ...
```

### 핵심 플로우

```
고객 주문 → 결제(DEMO/무통장) → 관리자 확인 → 슬롯 자동 배정 
→ 운영자 초대 발송 → 고객 수락 → 구독 활성화
```

---

## API 구조

### 공개 API
- `GET /api/products` - 상품 목록
- `GET /api/products/[id]` - 상품 상세

### 회원 API (세션 쿠키 필요)
- `POST /api/orders` - 주문 생성
- `GET /api/orders` - 주문 목록
- `POST /api/demo/payment/simulate` - DEMO 결제
- `GET /api/subscriptions` - 구독 목록
- `POST /api/refunds` - 환불 신청
- `GET /api/notifications` - 알림 목록
- `POST /api/tickets` - 문의 작성

### 관리자 API (SUPER_ADMIN / OPERATOR / SUPPORT 역할)
- `GET /api/admin/dashboard` - 대시보드 통계
- `POST /api/admin/payments/[id]/confirm` - 결제 확인
- `POST /api/admin/invitations/[id]/record-sent` - 초대 발송 기록
- `POST /api/admin/invitations/[id]/confirm-activation` - 활성화 확인
- `POST /api/admin/refunds/[id]/approve` - 환불 승인
- `GET /api/admin/members` - 회원 관리
- `GET /api/admin/groups` - 그룹 관리
- `POST /api/admin/bank-import` - CSV 입금 업로드

---

## 개발 가이드

### 새 서비스 추가
```typescript
// packages/domain/src/services/my.service.ts
export class MyService {
  constructor(private db: PrismaClient) {}
  async doSomething() { ... }
}

// packages/domain/src/index.ts에 export 추가
export { MyService } from './services/my.service'
```

### API Route 패턴
```typescript
// apps/web/src/app/api/route.ts
import { requireAuth, requireRole } from '@/lib/auth/session'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()  // 또는 requireRole('SUPER_ADMIN')
    // ... 비즈니스 로직
    return apiSuccess(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return apiError('로그인이 필요합니다.', 401)
    }
    return apiError('서버 오류', 500)
  }
}
```
