# Family Support Scope

_확인일: 2026-09-23_

## 명시

1. **Google/YouTube 공식 허가가 아니다.**  
   `FamilyOwnerConsent`는 운영·소유자 간 내부 동의 기록일 뿐, Google의 자동화·스크래핑·대리 로그인 허가를 의미하지 않는다.

2. **AUTHORIZED_BROWSER는 잠금.**  
   실 UI 미검증. 기본 `AUTHORIZED_BROWSER_ENABLED=false`. 드라이버는 항상 `POLICY_BLOCKED` 또는 `REAL_UI_UNVERIFIED`로 실패 처리하며 가짜 성공을 내지 않는다.

3. **DEMO만 자동 클릭.**  
   모의 관리 화면(`mock-family-admin:3100`)에서만 Playwright 완전 동작.

4. **ASSISTED**는 사람 안내만. 외부 자동 실행 없음.

5. **비밀정보 저장 금지**  
   비밀번호, 세션, 쿠키, 토큰을 DB / Sheets Outbox / 로그에 넣지 않는다.

## SUPPORT 역할

- 읽기: `/admin/family` 목록·상세·작업 상태 조회 가능
- 쓰기(큐잉/일시중지/긴급정지): SUPER_ADMIN / OPERATOR만

## 장애 시

- 전역 긴급정지: AppSetting `family.global_emergency_stop=true`
- 그룹 pause: `FamilyAutomationSetting.paused=true`
- 실연동 이슈는 체크리스트(`FAMILY_REAL_CONNECTION_CHECKLIST.md`) 미완으로 취급 — “버그 수정으로 실연동 완료”라고 보고하지 말 것
