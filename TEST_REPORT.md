# TEST REPORT

_Generated: 2026-09-23 (family automation)_

## 이번 세션에서 실제 실행한 결과

| 스위트 | 명령 | 결과 |
|--------|------|------|
| 단위 | `npm run test:unit` | **15 passed** (family-capacity 6 + refund 9) |
| 통합 | `npm run test:integration` | **5 passed** (family-demo 3 + allocation 2) |
| E2E (mock family) | `npm run test:e2e --workspace=apps/family-runner` | **3 passed** |
| family-runner DEMO INSPECT | mock :3100 + runner | **3/3 SUCCEEDED** (`DEMO 조회/연결 완료`) |
| migrate | `prisma migrate deploy` (premiumshare + test) | **적용됨** `20260923000000_family_automation` |
| seed | `npx tsx packages/domain/prisma/seed.ts` | Family DEMO settings 포함 |

## 가족 자동화 정책 상태 (미검증 명시)

| 항목 | 상태 |
|------|------|
| 실 Google/YouTube UI 연동 | **미수행 · 미검증** |
| AUTHORIZED_BROWSER | **잠금** (`AUTHORIZED_BROWSER_ENABLED=false`) |
| DEMO Playwright → mock admin | 로컬 :3100 |
| 비밀번호/세션 DB·Sheets 저장 | 하지 않음 |

## 문서

- `docs/FAMILY_AUTOMATION.md`
- `docs/FAMILY_SUPPORT_SCOPE.md`
- `docs/FAMILY_REAL_CONNECTION_CHECKLIST.md`
- `docs/FAMILY_SESSION_PROTECTION.md`
- `docs/FAMILY_ERROR_RECOVERY.md`
- `docs/FAMILY_VERIFICATION_REPORT.md`

## 데모 계정

| 이메일 | 비밀번호 | 역할 |
|--------|----------|------|
| admin@premiumshare.demo | Admin1234! | SUPER_ADMIN |
| operator@premiumshare.demo | Oper1234! | OPERATOR |
| support@premiumshare.demo | Supp1234! | SUPPORT |

## 참고

- 관리자 UI: `/admin/family`
- 완료 기준의 “실제 외부 결과 확인 후 DB 변경”은 DEMO 모의 경로에서 검증됨. 실 Google 계정 경로는 **미검증**.
