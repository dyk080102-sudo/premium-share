import {
  PrismaClient,
  FamilyAutomationMode,
  FamilyJobType,
  FamilyErrorCode,
} from '@prisma/client'

export type GateCheckResult = {
  ok: boolean
  errorCode?: FamilyErrorCode
  message?: string
  mode?: FamilyAutomationMode
  approvalId?: string
}

const EMERGENCY_STOP_KEYS = [
  'family.global_emergency_stop',
  'FAMILY_EMERGENCY_STOP',
]
const AUTHORIZED_ENABLED_KEY = 'family.authorized_browser_enabled'

function isTruthySetting(value: string | undefined | null): boolean {
  return value === 'true' || value === '1'
}

/**
 * 자동화 작업 실행 전 전제조건 검사.
 * AUTHORIZED_BROWSER는 기본 잠금 — 환경/설정이 명시적으로 열리지 않으면 POLICY_BLOCKED.
 */
export class FamilyGateService {
  constructor(private db: PrismaClient) {}

  private async isAnyEmergencyStop(): Promise<boolean> {
    const rows = await this.db.appSetting.findMany({
      where: { key: { in: EMERGENCY_STOP_KEYS } },
    })
    return rows.some((r) => isTruthySetting(r.value))
  }

  async assertCanRun(params: {
    groupId: string
    jobType: FamilyJobType
    requireApproval?: boolean
  }): Promise<GateCheckResult> {
    if (await this.isAnyEmergencyStop()) {
      return {
        ok: false,
        errorCode: FamilyErrorCode.EMERGENCY_STOP,
        message: '전역 긴급 정지 활성 — 자동화 실행 불가',
      }
    }

    const setting = await this.db.familyAutomationSetting.findUnique({
      where: { groupId: params.groupId },
    })
    if (!setting) {
      return {
        ok: false,
        errorCode: FamilyErrorCode.PRECONDITION_FAILED,
        message: '가족 자동화 설정이 없습니다',
      }
    }

    if (setting.paused) {
      return {
        ok: false,
        errorCode: FamilyErrorCode.PAUSED,
        message: '그룹 자동화가 일시 중지됨',
        mode: setting.mode,
      }
    }

    const group = await this.db.subscriptionGroup.findUnique({
      where: { id: params.groupId },
      select: { ownerAccountId: true },
    })
    if (!group) {
      return {
        ok: false,
        errorCode: FamilyErrorCode.PRECONDITION_FAILED,
        message: '구독 그룹을 찾을 수 없습니다',
      }
    }

    const consent = await this.db.familyOwnerConsent.findFirst({
      where: {
        ownerAccountId: group.ownerAccountId,
        isActive: true,
        revokedAt: null,
      },
      orderBy: { consentedAt: 'desc' },
    })
    if (!consent) {
      return {
        ok: false,
        errorCode: FamilyErrorCode.PRECONDITION_FAILED,
        message:
          '소유자 동의(FamilyOwnerConsent) 없음 — Google 공식 허가가 아닌 운영 동의 기록 필요',
        mode: setting.mode,
      }
    }

    if (setting.mode === FamilyAutomationMode.AUTHORIZED_BROWSER) {
      const envEnabled =
        process.env.AUTHORIZED_BROWSER_ENABLED === 'true' ||
        process.env.AUTHORIZED_BROWSER_ENABLED === '1'
      const settingFlag = await this.db.appSetting.findUnique({
        where: { key: AUTHORIZED_ENABLED_KEY },
      })
      const appEnabled =
        setting.authorizedEnabled === true &&
        (settingFlag?.value === 'true' || settingFlag?.value === '1')

      // 실 UI 미검증 — 기본 잠금. 가짜 성공 금지.
      if (!envEnabled || !appEnabled) {
        return {
          ok: false,
          errorCode: FamilyErrorCode.POLICY_BLOCKED,
          message:
            'AUTHORIZED_BROWSER 잠금: 실 Google/YouTube UI 미검증. REAL_UI_UNVERIFIED',
          mode: setting.mode,
        }
      }

      return {
        ok: false,
        errorCode: FamilyErrorCode.REAL_UI_UNVERIFIED,
        message:
          'AUTHORIZED_BROWSER는 정책상 잠금 유지. 실제 외부 UI 셀렉터 미검증 — 실행 거부',
        mode: setting.mode,
      }
    }

    if (params.requireApproval || setting.mode === FamilyAutomationMode.ASSISTED) {
      const approval = await this.db.familyApproval.findFirst({
        where: {
          groupId: params.groupId,
          jobType: params.jobType,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { approvedAt: 'desc' },
      })

      if (setting.mode === FamilyAutomationMode.ASSISTED && !approval) {
        // ASSISTED는 사람 개입 안내가 가능하므로 gate는 통과시키되 approval 없음 표시
        return {
          ok: true,
          mode: setting.mode,
          message: 'ASSISTED — 사람 확인/승인 후 외부 작업 진행',
        }
      }

      if (params.requireApproval && !approval) {
        return {
          ok: false,
          errorCode: FamilyErrorCode.PRECONDITION_FAILED,
          message: '해당 작업 유형의 유효한 FamilyApproval이 없습니다',
          mode: setting.mode,
        }
      }

      return {
        ok: true,
        mode: setting.mode,
        approvalId: approval?.id,
      }
    }

    return { ok: true, mode: setting.mode }
  }

  async isEmergencyStopped(): Promise<boolean> {
    return this.isAnyEmergencyStop()
  }

  async setEmergencyStop(active: boolean, updatedBy: string): Promise<void> {
    const value = active ? 'true' : 'false'
    for (const key of EMERGENCY_STOP_KEYS) {
      await this.db.appSetting.upsert({
        where: { key },
        create: {
          key,
          value,
          description: '가족 자동화 전역 긴급 정지',
          updatedBy,
        },
        update: { value, updatedBy },
      })
    }
  }
}
