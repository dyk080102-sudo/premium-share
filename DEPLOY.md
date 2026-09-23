# 배포 안내 (GitHub + Vercel)

이 저장소를 GitHub에 올린 뒤 Vercel에 연결하면 웹사이트가 올라갑니다.
도메인은 Vercel 대시보드에서 직접 추가하면 됩니다.

## 1. GitHub

이미 이 저장소가 GitHub에 있으면 이 단계는 건너뛰세요.

## 2. Vercel 프로젝트 연결

1. [vercel.com](https://vercel.com)에서 GitHub 저장소를 Import
2. Framework Preset: **Next.js**
3. Root Directory: 저장소 루트 (비워 두세요)
4. 아래 환경변수를 설정합니다.

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | 필수 | PostgreSQL 연결 문자열 (Neon, Supabase, Railway 등) |
| `NEXTAUTH_SECRET` | 필수 | 세션 서명 키 (32자 이상 랜덤 문자열) |
| `NEXTAUTH_URL` | 필수 | 배포 URL. 예: `https://your-domain.com` |
| `BUSINESS_MODE` | 권장 | `DEMO` 또는 `MANUAL` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | 선택 | 실제 메일 발송 시 |

5. 첫 배포 후 **Vercel CLI 또는 대시보드**에서 마이그레이션과 시드를 한 번 실행해야 합니다.

```bash
npx prisma migrate deploy --schema=packages/domain/prisma/schema.prisma
npx tsx packages/domain/prisma/seed.ts
```

로컬에서 `DATABASE_URL`을 프로덕션 DB로 지정한 뒤 실행해도 됩니다.

## 3. 도메인 추가

Vercel → Project → Settings → Domains에서 원하는 도메인을 추가하세요.
`NEXTAUTH_URL`도 같은 도메인으로 맞춘 뒤 재배포하세요.

## 4. 백그라운드 작업

Vercel은 서버리스라서 `dev:unified`의 워커/패밀리 러너는 함께 뜨지 않습니다.
주문·결제·관리자 화면은 웹만으로 동작합니다.

장기 운영 시에는 Railway/Render 같은 상시 서버에서 `npm run start:unified`를 쓰거나,
워커를 별도 프로세스로 띄우면 됩니다.
