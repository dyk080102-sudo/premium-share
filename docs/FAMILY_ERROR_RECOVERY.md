# Family Error Recovery / Manual Playbook

_확인일: 2026-09-23_

## 공통

외부 브라우저 작업과 DB 변경은 원자적 트랜잭션이 아니다.

1. 작업 의도 기록 (`FamilyJob` QUEUED)
2. 외부 실행 (family-runner)
3. 외부 재확인 후 내부 반영

재시도 시 **항상 외부 상태부터** 확인한다. 완료된 초대를 재발송하거나, 제거 미확인 슬롯을 FREE로 만들지 않는다.

## 오류 코드 → 조치

| 코드 | 조치 |
|------|------|
| `SESSION_EXPIRED` | ASSISTED 전환. 운영자 재로그인. 자동 재시도 금지. |
| `HUMAN_ACTION_REQUIRED` | 관리 작업 생성. 공식 화면 안내. |
| `ACCOUNT_MISMATCH` | 실행 중단. 계정 연결 재확인. |
| `PERMISSION_DENIED` | 관리자 권한·그룹 재확인. |
| `POLICY_BLOCKED` | AUTHORIZED 잠금 등. 자동 실행 비활성 유지. |
| `PLAN_NOT_ACTIVE` | 슬롯 판매·배정 보류. 결제/요금제 수동. |
| `GROUP_FULL` | 신규 초대 중단. 정원·초대 재조회. |
| `TARGET_AMBIGUOUS` | 이메일 확인 전 실행 금지. |
| `INVITE_LIMIT_REACHED` | 재시도 중단 또는 허용 시점까지 대기. 계정 순환 금지. |
| `UI_CHANGED` | AUTHORIZED 드라이버 잠금. 셀렉터 추측 클릭 금지. |
| `EXTERNAL_RESULT_UNKNOWN` | 목록 재조회. 성공으로 표시하지 않음. |
| `REAL_UI_UNVERIFIED` | 실 UI 미검증. 실행하지 않음. |
| `EMERGENCY_STOP` / `PAUSED` | 재시작 시 승인·도메인 상태 재확인. |

## 긴급 중지

- 전역: AppSetting `family.global_emergency_stop=true`
- 그룹: `FamilyAutomationSetting.paused=true`
- 관리자 UI: `/admin/family` 긴급정지·일시정지

중지 해제 후 남은 작업을 무조건 실행하지 않는다. gate·승인·도메인 버전을 다시 검사한다.

## 제거·갱신 충돌

- 제거 직전 갱신 확인 → 제거 취소 또는 재검토
- 제거 시작 후 갱신 → 자동 재초대 금지. 외부 상태 확인 후 복구 또는 운영 검토
- 제거 확인 전 Allocation을 FREE로 바꾸지 않음 (`REMOVAL_VERIFY_PENDING` 유지)

## Sheets

Outbox 실패는 worker 재시도로 처리한다. Sheets 반영은 DB 기록 **이후** 목표이며, Google 실제 변경 순간부터의 SLA를 보장하지 않는다.
