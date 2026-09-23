import type { FamilyJob } from '@prisma/client'
import type { DriverResult, FamilyDriver } from './types'

/**
 * AUTHORIZED_BROWSER: 항상 잠금.
 * 가짜 성공 금지. POLICY_BLOCKED 또는 REAL_UI_UNVERIFIED만 반환.
 * 실제 Google/YouTube UI selector를 작성하지 않는다.
 */
export class AuthorizedFamilyDriver implements FamilyDriver {
  readonly name = 'authorized'

  async execute(job: FamilyJob): Promise<DriverResult> {
    const envEnabled =
      process.env.AUTHORIZED_BROWSER_ENABLED === 'true' ||
      process.env.AUTHORIZED_BROWSER_ENABLED === '1'

    if (!envEnabled) {
      return {
        outcome: 'FAILED',
        errorCode: 'POLICY_BLOCKED',
        summary:
          'AUTHORIZED_BROWSER 잠금: AUTHORIZED_BROWSER_ENABLED=false. 실 UI 미검증 — 실행하지 않음.',
        externalResult: {
          mode: 'AUTHORIZED_BROWSER',
          executed: false,
          locked: true,
        },
      }
    }

    // 환경 플래그가 켜져 있어도 실 셀렉터 미검증이므로 성공으로 보고하지 않음
    return {
      outcome: 'FAILED',
      errorCode: 'REAL_UI_UNVERIFIED',
      summary: [
        'AUTHORIZED_BROWSER: 실제 Google/YouTube UI 셀렉터는 미검증 상태입니다.',
        '검증된 것처럼 보이는 selector/PoC를 제공하지 않습니다.',
        `요청된 작업(${job.type})은 실행되지 않았습니다.`,
      ].join(' '),
      externalResult: {
        mode: 'AUTHORIZED_BROWSER',
        executed: false,
        realUiUnverified: true,
        jobId: job.id,
      },
    }
  }
}
