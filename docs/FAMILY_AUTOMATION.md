# Family Automation

_확인일: 2026-09-23_

## 모드

| 모드 | 동작 |
|------|------|
| **DEMO** | `MOCK_FAMILY_ADMIN_URL` 모의 관리 화면에서 Playwright가 role/label로 실제 클릭. 완전 동작은 모의 UI에 한함. |
| **ASSISTED** | 외부 자동 클릭 없음. `HUMAN_ACTION_REQUIRED` / 안내만 반환. |
| **AUTHORIZED_BROWSER** | **잠금**. 실 Google/YouTube UI 셀렉터 미검증. `POLICY_BLOCKED` 또는 `REAL_UI_UNVERIFIED`. 가짜 성공 금지. |

기본값: `FAMILY_AUTOMATION_MODE=DEMO`, `AUTHORIZED_BROWSER_ENABLED=false`.

## 지원 범위

- 정원 합산(외부 점유 + 유효 초대 + 내부 예약 + 제거 대기) 및 모순 시 배정 보류
- 작업 큐 (enqueue / claim / complete / fail) + 계정별 락
- 외부 스냅샷 → 내부 슬롯 동기화
- 초대/제거 큐잉 (제거 확인 전 Allocation FREE/RECLAIMED 금지)
- Sheets용 Outbox 이벤트 (비밀번호·세션·쿠키 제외)
- Admin UI `/admin/family`

## 실연동 미검증

- 실제 Google/YouTube Family 관리 UI에 대한 selector·로그인·세션 흐름은 **검증하지 않음**.
- AUTHORIZED_BROWSER 드라이버는 항상 실행을 거부한다.
- “검증된 것처럼” 보이는 실 UI 셀렉터를 코드에 넣지 않는다.

## 세션 보호

- 비밀번호 / 세션 / 쿠키 / 토큰을 DB·Sheets·로그·Outbox에 저장하지 않는다.
- `FamilyBrowserProfileMeta`는 경로 해시·라벨만 허용.
- `FamilyOwnerConsent`는 **운영자 동의 기록**이며 Google 공식 허가가 아니다.

## 로컬 실행

```bash
npm run dev:mock-family    # :3100 mock admin
npm run dev:family-runner  # 큐 폴링
```

Docker: `mock-family-admin`, `family-runner` 서비스 참고 (`docker-compose.yml`).

## 관련 문서

- `FAMILY_SESSION_PROTECTION.md`
- `FAMILY_ERROR_RECOVERY.md`
- `FAMILY_VERIFICATION_REPORT.md`
- `FAMILY_REAL_CONNECTION_CHECKLIST.md`
- `FAMILY_SUPPORT_SCOPE.md`
