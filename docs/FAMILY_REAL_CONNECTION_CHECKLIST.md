# Family Real Connection Checklist

_확인일: 2026-09-23_

## 상태: 실연동 미수행

아래 항목은 **수행하지 않았다**. AUTHORIZED_BROWSER는 잠금 상태다.

- [ ] 실제 Google 계정 로그인 세션으로 가족 관리 화면 접근
- [ ] 실제 YouTube/Google Family UI DOM/selector 검증
- [ ] 실환경 초대 발송·수락·제거 E2E
- [ ] 실환경 CAPTCHA / 2FA / 결제 화면 분기 처리
- [ ] AUTHORIZED_BROWSER_ENABLED=true 로의 운영 승인 절차
- [ ] 프로덕션 브라우저 프로필 격리·폐기 절차 검증

## 허용된 검증

- [x] DEMO mock-family-admin (포트 3100) role/label Playwright
- [x] 도메인 게이트: AUTHORIZED 모드 시 POLICY_BLOCKED / REAL_UI_UNVERIFIED
- [x] 비밀번호·세션 미저장 정책 문서화

## 잠금 해제 전 필수 (미완)

1. 법률/약관/공식 API 또는 명시적 허가 범위 문서화
2. 실 UI selector를 **실측**으로 고정하고 회귀 테스트
3. `AUTHORIZED_BROWSER_ENABLED` + `authorizedEnabled` 이중 플래그 운영 승인
4. 세션 저장 금지 감사

현재 코드는 위 조건 없이도 “성공”을 반환하지 않는다.
