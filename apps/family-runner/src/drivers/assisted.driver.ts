import type { FamilyJob } from '@prisma/client'
import type { DriverResult, FamilyDriver } from './types'

/**
 * ASSISTED: 실제 외부 UI를 클릭하지 않음.
 * HUMAN_ACTION_REQUIRED / ASSISTED 안내 결과만 반환.
 */
export class AssistedFamilyDriver implements FamilyDriver {
  readonly name = 'assisted'

  async execute(job: FamilyJob): Promise<DriverResult> {
    return {
      outcome: 'AWAITING_HUMAN',
      errorCode: 'HUMAN_ACTION_REQUIRED',
      summary: [
        'ASSISTED 모드: 자동 클릭/실연동을 수행하지 않았습니다.',
        `작업: ${job.type}`,
        job.targetEmail ? `대상: ${job.targetEmail}` : null,
        '운영자가 외부 관리 화면에서 수동 처리 후 결과를 기록하세요.',
        '이 결과는 성공이 아닙니다.',
      ]
        .filter(Boolean)
        .join(' '),
      externalResult: {
        mode: 'ASSISTED',
        executed: false,
        humanActionRequired: true,
      },
    }
  }
}
