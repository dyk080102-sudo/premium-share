# 배포·반영 가이드 (PremiumShare)

이 프로젝트는 **HTML 파일만 FTP로 올리는 방식**이 아닙니다.  
**Next.js + PostgreSQL** 앱이며, 실제 사이트는 **GitHub → Vercel**로 배포됩니다.

| 항목 | 현재 값 |
|------|---------|
| 웹사이트 유형 | Next.js 14 (App Router) 모노레포 |
| 호스팅 | **Vercel** (프로덕션 URL 예: `https://premium-share-web-eta.vercel.app`) |
| 업로드 방식 | **Git push** (FileZilla/FTP 사용 안 함) |
| DB | PostgreSQL (Neon/Supabase/Railway 등 — `DATABASE_URL`) |
| 변경 반영 경로 | PR 머지 → `main` → Vercel Production 자동 빌드 |

> 정적 데모(`demos/static-github-pages/`)는 GitHub Pages용 아카이브입니다.  
> **상용 사이트는 Vercel의 Next.js 앱**을 기준으로 하세요.

---

## 0. 지금 상태 한눈에

1. 코드 변경은 브랜치 `cursor/demo-to-production-d166` / PR에 있습니다.
2. Vercel **Preview**에는 이미 새 커밋이 올라갈 수 있습니다.
3. **Production**에 즉시 반영하려면 `main`에 머지(또는 Production 프로모션)가 필요합니다.
4. 스키마 변경(결제 `depositorName` 등)이 있으므로 **DB 마이그레이션을 배포와 함께** 적용해야 합니다.

---

## 1. 변경분만 효율적으로 “업로드”하는 절차 (권장)

FTP로 파일 몇 개만 덮어쓰지 않습니다.  
Git이 **변경된 커밋만** 서버(Vercel)에 전달하고, Vercel이 **필요한 부분만 다시 빌드**합니다.

### A. PR이 이미 있는 경우 (지금 상황)

1. PR 열기: https://github.com/dyk080102-sudo/premium-share/pull/1  
2. Checks(CI)가 초록인지 확인  
3. **Merge pull request** → `main`에 병합  
4. Vercel 대시보드 → 해당 프로젝트 → **Deployments**  
   - `Production` 배포가 `Building` → `Ready`가 될 때까지 대기 (보통 1~3분)  
5. 아래 **§3 체크리스트**로 사이트 확인  

### B. 로컬에서 추가 수정 후 올릴 때

```bash
# 1) 작업 브랜치에서
git status
git add -A
git commit -m "설명 있는 커밋 메시지"
git push -u origin HEAD

# 2) GitHub에서 PR 생성/업데이트 → Review → Merge into main
```

Vercel이 `main` push를 감지하면 **Production**이 자동 재배포됩니다.  
별도 FileZilla 업로드는 필요 없습니다.

### C. Preview만 먼저 보고 싶을 때

- PR 페이지의 **Visit preview** / Vercel Preview URL로 확인  
- 문제 없으면 `main` 머지로 Production 반영  

### D. (선택) Vercel CLI로 수동 배포

GitHub 연동이 끊겼을 때만 사용합니다.

```bash
npm i -g vercel
vercel login
vercel link          # 기존 프로젝트 연결
vercel --prod        # Production 배포
```

---

## 2. 업로드(배포) 전 백업

### 2-1. 코드 백업 (항상)

| 방법 | 설명 |
|------|------|
| GitHub | `main` / 태그 / PR 브랜치가 이미 백업입니다 |
| 로컬 태그 | `git tag backup-YYYYMMDD && git push origin backup-YYYYMMDD` |
| Vercel Rollback | Deployments → 이전 Production → **⋯ → Promote to Production** / Rollback |

배포 실패 시 **직전 Production 배포로 즉시 롤백**하면 됩니다. (파일 복원보다 안전)

### 2-2. 데이터베이스 백업 (스키마/데이터 변경 전 필수)

이번 변경에는 Prisma 마이그레이션  
`20260924000000_production_payment_fields` 가 포함됩니다.  
**Production DB에 적용하기 전에** 스냅샷을 뜨세요.

#### Neon
1. Neon 콘솔 → 프로젝트 → **Branches** 또는 **Backups**  
2. 배포 직전 브랜치/스냅샷 생성  

#### Supabase
1. Project → **Database** → **Backups**  
2. 또는 SQL Editor에서 필요 테이블 dump  

#### 공통 (pg_dump)

```bash
# 로컬에서 Production DATABASE_URL로 (읽기 전용 권장 시간대에)
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d-%H%M).dump
```

### 2-3. 환경변수 백업

Vercel → Project → **Settings → Environment Variables**  
값을 메모장/비밀번호 관리자에 복사해 두세요. (시크릿은 Git에 커밋하지 말 것)

필수 확인:

| 변수 | 상용 권장값 |
|------|-------------|
| `DATABASE_URL` | Production Postgres |
| `NEXTAUTH_URL` / `APP_URL` | 실제 도메인 (`https://…`) |
| `NEXTAUTH_SECRET` | 32자 이상 랜덤 |
| `BUSINESS_MODE` | **`MANUAL`** |
| `PAYMENT_PROVIDER` | `manual` |

---

## 3. 배포 직후 “즉시 반영” 체크리스트

### 3-1. 서버(배포) 쪽

- [ ] Vercel Deployments에서 최신 커밋 SHA가 **Production / Ready**  
- [ ] Build 로그에 Prisma generate / Next build 에러 없음  
- [ ] Production 환경변수 `BUSINESS_MODE=MANUAL`  
- [ ] **DB 마이그레이션 적용** (한 번만 / 아직 안 했다면 경우):

```bash
# 로컬에서 Production DB를 가리킨 채로
export DATABASE_URL="postgresql://…프로덕션…"
npx prisma migrate deploy --schema=packages/domain/prisma/schema.prisma
```

> Seed(`db:seed`)는 **최초 구축용**입니다. 이미 회원/주문이 있는 운영 DB에는 다시 돌리지 마세요.

- [ ] (선택) 워커가 필요하면 Railway/Render 등에서 `npm run start:unified` 또는 `dev:worker` 별도 기동  
  - Vercel만으로는 주문 만료/메일 outbox 크론이 안 돕니다 (`DEPLOY.md` §4)

### 3-2. 브라우저 캐시

Next/Vercel은 배포마다 번들 해시가 바뀌어 대부분 자동 반영됩니다.  
안 바뀌면:

1. **시크릿/프라이빗 창**으로 접속  
2. Hard refresh: `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`)  
3. 개발자도구 → Network → **Disable cache** 켠 뒤 새로고침  
4. 서비스워커가 있다면 Application → Unregister (이 앱은 기본 SW 없음)

### 3-3. CDN / Vercel 캐시

- Vercel 대시보드 → Deployments → 해당 배포 → **⋯ → Redeploy** (필요 시)  
- 커스텀 도메인 DNS가 옛 호스팅을 가리키지 않는지 확인 (GitHub Pages vs Vercel)

### 3-4. 기능 스모크 (상용)

| 확인 | 기대 |
|------|------|
| 홈 / 상품 목록 | 200, 데모 노란 배너 없음 (`MANUAL`) |
| 로그인 | 세션 쿠키 `ps_session` |
| 주문 생성 | `source: MANUAL` |
| 입금 신고 | `/orders/[id]/payment` 동작 |
| DEMO 결제 버튼 | 보이지 않음 / API 405 |
| 관리자 결제 확인 | 입금자명 표시·확인 가능 |

---

## 4. 하지 말아야 할 것

| 잘못된 방법 | 이유 |
|-------------|------|
| FileZilla로 `apps/web/src` 일부만 업로드 | Next는 **빌드 산출물**이 필요. 소스만 덮으면 반영 안 됨 |
| `demos/static-github-pages/`만 GitHub Pages에 올림 | localStorage 데모이며 **상용 DB와 무관** |
| Production에 `BUSINESS_MODE=DEMO` | 가상 결제 노출 |
| 운영 DB에 `db:seed` 재실행 | 시나리오 데이터 덮어쓰기 위험 |
| `.env` / DB 비밀번호를 Git에 커밋 | 보안 사고 |

---

## 5. 빠른 요약 (복사해서 쓰기)

```text
1. DB 백업 (Neon/Supabase 스냅샷 또는 pg_dump)
2. Vercel env: BUSINESS_MODE=MANUAL, NEXTAUTH_URL=실도메인 확인
3. GitHub PR → Merge to main
4. Vercel Production Ready 확인
5. prisma migrate deploy (프로덕션 DATABASE_URL)
6. 시크릿 창으로 사이트 접속 → 로그인/주문/입금신고/관리자 확인
7. 문제 시 Vercel Rollback + (필요 시) DB 스냅샷 복구
```

## 8. 현재 Production 장애: DATABASE_URL 미설정

`/api/health` 가 아래처럼 나오면 Vercel 환경변수가 비어 있는 상태입니다.

```json
{ "ok": false, "hasDatabaseUrl": false, "db": { "connected": false } }
```

### 즉시 조치 (Vercel 대시보드)

1. https://vercel.com/preshare/premium-share-web → **Settings → Environment Variables**
2. Production / Preview 모두에 추가:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Postgres 연결 URL (Neon/Supabase/Railway 등) |
| `NEXTAUTH_URL` | `https://premium-share-web-eta.vercel.app` |
| `APP_URL` | `https://premium-share-web-eta.vercel.app` |
| `NEXTAUTH_SECRET` | 32자 이상 랜덤 문자열 |
| `BUSINESS_MODE` | `MANUAL` |
| `PAYMENT_PROVIDER` | `manual` |
| `CRON_SECRET` | (권장) 랜덤 문자열 |

3. **Deployments → 최신 Production → Redeploy** (환경변수 적용)
4. 로컬에서 한 번 마이그레이션·시드:

```bash
export DATABASE_URL="(위에서 넣은 프로덕션 URL)"
npx prisma migrate deploy --schema=packages/domain/prisma/schema.prisma
npx tsx packages/domain/prisma/seed.ts   # 최초 1회만
```

5. 확인: `https://premium-share-web-eta.vercel.app/api/health` → `"ok": true`

`main` push 후 GitHub Deployments에 **Preview**만 생기고  
`https://premium-share-web-eta.vercel.app` 이 옛 버전일 수 있습니다.

Vercel 대시보드에서 수동 Promote:

1. https://vercel.com/preshare/premium-share-web 접속
2. **Deployments** → 최신 성공 배포 (커밋 메시지에 Production 전환/cron 관련)
3. 오른쪽 **⋯ → Promote to Production**
4. Environment Variables 확인:
   - `DATABASE_URL` (Postgres)
   - `NEXTAUTH_URL`=`https://premium-share-web-eta.vercel.app`
   - `APP_URL`=동일
   - `NEXTAUTH_SECRET` (32자+)
   - `BUSINESS_MODE`=`MANUAL`
5. 배포 후 `https://premium-share-web-eta.vercel.app/api/health` → `"ok": true`

Preview SSO(Deployment Protection)이 켜져 있으면 외부에서 Preview URL 테스트가 막힙니다.  
Production Promote 후 공개 URL로 확인하세요.

```bash
curl -sS https://YOUR_DOMAIN/api/health | jq
```

`ok: true` 이고 `db.connected: true` 여야 API/상품/로그인이 정상입니다.  
`ok: false` 이면 Vercel Environment Variables의 `DATABASE_URL`과 Prisma 마이그레이션을 확인하세요.

백그라운드 작업(주문 만료·대기열·메일)은 Vercel Cron `/api/cron/tick` 으로 실행됩니다.  
Hobby 플랜은 **하루 1회** cron만 허용하므로 기본 스케줄은 `0 12 * ** *(UTC 12:00)`입니다.  
더 자주 돌리려면 Pro 플로 업그레이드하거나, 외부 크론이 `Authorization: Bearer $CRON_SECRET` 으로  
`GET /api/cron/tick` 을 호출하면 됩니다.
