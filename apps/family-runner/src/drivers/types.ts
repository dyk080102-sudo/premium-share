import type { FamilyJob, FamilyErrorCode, FamilyJobType } from '@prisma/client'

export type DriverResult = {
  /** 실제 수행 결과만. 미실행을 SUCCEEDED로 보고하지 말 것. */
  outcome:
    | 'SUCCEEDED'
    | 'AWAITING_HUMAN'
    | 'FAILED'
    | 'EXTERNAL_RESULT_UNKNOWN'
  errorCode?: FamilyErrorCode
  summary: string
  observed?: {
    externalGroupKey?: string | null
    planActiveConfirmed?: boolean
    capacityTotal?: number | null
    adminSeats?: number
    members?: Array<{
      email: string
      displayName?: string | null
      kind: 'ADMIN' | 'MEMBER' | 'PENDING_INVITE' | 'UNMANAGED'
      externalStatus?:
        | 'OBSERVED'
        | 'INVITED'
        | 'JOINED'
        | 'REMOVAL_PENDING'
        | 'REMOVED'
        | 'UNKNOWN'
    }>
  }
  externalResult?: Record<string, unknown>
}

export interface FamilyDriver {
  readonly name: string
  execute(job: FamilyJob): Promise<DriverResult>
  supports?(type: FamilyJobType): boolean
}
