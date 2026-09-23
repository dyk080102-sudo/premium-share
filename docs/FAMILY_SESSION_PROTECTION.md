# Family Session Protection

_확인일: 2026-09-23_

## 원칙

- 최초 로그인·추가 본인 확인은 운영자가 Google 정상 로그인으로 직접 수행한다.
- 플랫폼 회원가입/관리 화면에서 Google 비밀번호를 받지 않는다.
- 업무 DB·Google Sheets·Excel·일반 로그에 외부 인증 쿠키·세션·storageState를 저장하지 않는다.
- `FamilyBrowserProfileMeta`에는 프로필 경로 **해시**와 라벨·오류 코드만 허용한다.

## DEMO / ASSISTED

- DEMO: 모의 관리 화면만 사용. 실제 Google 세션 불필요.
- ASSISTED: 자동 클릭 없음. `HUMAN_ACTION_REQUIRED`로 전환.

## AUTHORIZED_BROWSER (잠금)

- 기본 `AUTHORIZED_BROWSER_ENABLED=false`.
- 실 Google/YouTube UI 셀렉터 **미검증**.
- 플래그가 true여도 드라이버는 `REAL_UI_UNVERIFIED`로 실패하며 가짜 성공을 내지 않는다.
- 로그인 허용·격리 프로필·디스크 암호화 등 운영 조건이 준비되기 전 실제 세션을 만들지 않는다.

## 허용(제한적) — 향후 실연동 시

실연동이 승인되면 다음만 허용한다.

1. 전용 실행 계정의 격리된 브라우저 프로필
2. 프로필 매체 암호화 및 OS 접근 권한 제한
3. 원격 디버깅 포트 비공개
4. 연결 해제·프로필 폐기 절차
5. 로그인·카드·인증 화면 비녹화

일반 사용자 브라우저 프로필을 무단으로 읽지 않는다.

## 오류 기록

| 상황 | 코드 |
|------|------|
| 세션 만료 | `SESSION_EXPIRED` |
| 추가 인증·수동 필요 | `HUMAN_ACTION_REQUIRED` |
| 계정 불일치 | `ACCOUNT_MISMATCH` |

실패한 로그인을 무한 반복하지 않는다. 중지 후 ASSISTED로 전환한다.
