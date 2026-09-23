import {
  PrismaClient,
  FamilyJobType,
  FamilyJobStatus,
  FamilyErrorCode,
  FamilyAutomationMode,
  Prisma,
} from '@prisma/client'
import { AuditService } from '../audit.service'
import { FamilyGateService } from './gate.service'

export type EnqueueJobInput = {
  type: FamilyJobType
  groupId: string
  ownerAccountId: string
  idempotencyKey: string
  subscriptionId?: string
  allocationId?: string
  targetEmail?: string
  mode?: FamilyAutomationMode
  approvalId?: string
  beforeJson?: Prisma.InputJsonValue
  requireApproval?: boolean
  actorId?: string
}

/**
 * 가족 자동화 작업 큐: enqueue / claim / complete / fail.
 * 동일 ownerAccountId에 대해 IN_PROGRESS/CLAIMED 작업이 있으면 추가 claim 거부(계정 락).
 */
export class FamilyJobService {
  private audit: AuditService
  private gate: FamilyGateService

  constructor(private db: PrismaClient) {
    this.audit = new AuditService(db)
    this.gate = new FamilyGateService(db)
  }

  async enqueue(input: EnqueueJobInput) {
    const existing = await this.db.familyJob.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    })
    if (existing) return existing

    const gate = await this.gate.assertCanRun({
      groupId: input.groupId,
      jobType: input.type,
      requireApproval: input.requireApproval,
    })

    if (!gate.ok) {
      const failed = await this.db.familyJob.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          type: input.type,
          groupId: input.groupId,
          ownerAccountId: input.ownerAccountId,
          subscriptionId: input.subscriptionId,
          allocationId: input.allocationId,
          targetEmail: input.targetEmail,
          status: FamilyJobStatus.FAILED,
          errorCode: gate.errorCode,
          mode: gate.mode ?? input.mode ?? FamilyAutomationMode.DEMO,
          approvalId: gate.approvalId ?? input.approvalId,
          beforeJson: input.beforeJson,
          resultSummary: gate.message,
          completedAt: new Date(),
        },
      })
      await this.audit.log({
        actorId: input.actorId,
        targetType: 'FamilyJob',
        targetId: failed.id,
        action: 'FAMILY_JOB_GATE_REJECTED',
        after: { errorCode: gate.errorCode, message: gate.message },
      })
      return failed
    }

    const setting = await this.db.familyAutomationSetting.findUnique({
      where: { groupId: input.groupId },
    })
    const mode =
      input.mode ?? gate.mode ?? setting?.mode ?? FamilyAutomationMode.DEMO

    const job = await this.db.familyJob.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        type: input.type,
        groupId: input.groupId,
        ownerAccountId: input.ownerAccountId,
        subscriptionId: input.subscriptionId,
        allocationId: input.allocationId,
        targetEmail: input.targetEmail,
        status: FamilyJobStatus.QUEUED,
        mode,
        approvalId: gate.approvalId ?? input.approvalId,
        beforeJson: input.beforeJson,
      },
    })

    await this.audit.log({
      actorId: input.actorId,
      targetType: 'FamilyJob',
      targetId: job.id,
      action: 'FAMILY_JOB_ENQUEUED',
      after: { type: job.type, mode: job.mode, status: job.status },
    })

    return job
  }

  /**
   * 계정별 락: 동일 ownerAccountId에 CLAIMED/IN_PROGRESS가 있으면 skip.
   * 단, lockedAt이 STALE_LOCK_MS 이상이면 좀비 락으로 보고 QUEUED로 되돌린다.
   */
  async claimNext(workerId: string, types?: FamilyJobType[]) {
    const STALE_LOCK_MS = parseInt(
      process.env.FAMILY_JOB_STALE_LOCK_MS ?? String(5 * 60 * 1000),
      10,
    )
    const staleBefore = new Date(Date.now() - STALE_LOCK_MS)

    return this.db.$transaction(async (tx) => {
      await tx.familyJob.updateMany({
        where: {
          status: {
            in: [FamilyJobStatus.CLAIMED, FamilyJobStatus.IN_PROGRESS],
          },
          lockedAt: { lt: staleBefore },
        },
        data: {
          status: FamilyJobStatus.QUEUED,
          lockedBy: null,
          lockedAt: null,
          resultSummary: 'stale lock reclaimed',
        },
      })

      const busyOwners = await tx.familyJob.findMany({
        where: {
          status: {
            in: [FamilyJobStatus.CLAIMED, FamilyJobStatus.IN_PROGRESS],
          },
        },
        select: { ownerAccountId: true },
        distinct: ['ownerAccountId'],
      })
      const busySet = busyOwners.map((b) => b.ownerAccountId)

      const candidates = await tx.familyJob.findMany({
        where: {
          status: FamilyJobStatus.QUEUED,
          ...(types?.length ? { type: { in: types } } : {}),
          ...(busySet.length
            ? { ownerAccountId: { notIn: busySet } }
            : {}),
        },
        orderBy: { requestedAt: 'asc' },
        take: 1,
      })

      if (candidates.length === 0) return null

      const job = candidates[0]
      return tx.familyJob.update({
        where: { id: job.id },
        data: {
          status: FamilyJobStatus.CLAIMED,
          lockedBy: workerId,
          lockedAt: new Date(),
          startedAt: new Date(),
        },
      })
    })
  }

  async markInProgress(jobId: string, workerId: string) {
    const job = await this.db.familyJob.findUnique({ where: { id: jobId } })
    if (!job) throw new Error('작업을 찾을 수 없습니다.')
    if (job.lockedBy !== workerId) {
      throw new Error('다른 워커가 잠근 작업입니다.')
    }
    return this.db.familyJob.update({
      where: { id: jobId },
      data: { status: FamilyJobStatus.IN_PROGRESS },
    })
  }

  async complete(
    jobId: string,
    result: {
      afterJson?: Prisma.InputJsonValue
      externalResultJson?: Prisma.InputJsonValue
      resultSummary?: string
      observedAt?: Date
      status?:
        | typeof FamilyJobStatus.SUCCEEDED
        | typeof FamilyJobStatus.AWAITING_HUMAN
        | typeof FamilyJobStatus.EXTERNAL_RESULT_UNKNOWN
    },
  ) {
    const status = result.status ?? FamilyJobStatus.SUCCEEDED
    // 실행되지 않은 작업을 성공으로 표시하지 말 것 — 호출측이 실제 결과만 전달해야 함
    return this.db.familyJob.update({
      where: { id: jobId },
      data: {
        status,
        afterJson: result.afterJson,
        externalResultJson: result.externalResultJson,
        resultSummary: result.resultSummary,
        observedAt: result.observedAt ?? new Date(),
        completedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        errorCode: null,
      },
    })
  }

  async fail(
    jobId: string,
    errorCode: FamilyErrorCode,
    message?: string,
    externalResultJson?: Prisma.InputJsonValue,
  ) {
    return this.db.familyJob.update({
      where: { id: jobId },
      data: {
        status: FamilyJobStatus.FAILED,
        errorCode,
        resultSummary: message,
        externalResultJson,
        completedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      },
    })
  }

  async awaitHuman(jobId: string, message: string, errorCode?: FamilyErrorCode) {
    return this.db.familyJob.update({
      where: { id: jobId },
      data: {
        status: FamilyJobStatus.AWAITING_HUMAN,
        errorCode: errorCode ?? FamilyErrorCode.HUMAN_ACTION_REQUIRED,
        resultSummary: message,
        lockedBy: null,
        lockedAt: null,
      },
    })
  }

  async retry(jobId: string, actorId?: string) {
    const job = await this.db.familyJob.findUnique({ where: { id: jobId } })
    if (!job) throw new Error('작업을 찾을 수 없습니다.')
    if (
      ![
        FamilyJobStatus.FAILED,
        FamilyJobStatus.CANCELLED,
        FamilyJobStatus.AWAITING_HUMAN,
        FamilyJobStatus.EXTERNAL_RESULT_UNKNOWN,
      ].includes(job.status)
    ) {
      throw new Error('재시도 가능한 상태가 아닙니다.')
    }

    const updated = await this.db.familyJob.update({
      where: { id: jobId },
      data: {
        status: FamilyJobStatus.QUEUED,
        errorCode: null,
        resultSummary: null,
        completedAt: null,
        startedAt: null,
        lockedBy: null,
        lockedAt: null,
        retryCount: { increment: 1 },
      },
    })

    await this.audit.log({
      actorId,
      targetType: 'FamilyJob',
      targetId: jobId,
      action: 'FAMILY_JOB_RETRY',
      before: { status: job.status },
      after: { status: FamilyJobStatus.QUEUED },
    })

    return updated
  }

  async listByGroup(groupId: string, take = 50) {
    return this.db.familyJob.findMany({
      where: { groupId },
      orderBy: { requestedAt: 'desc' },
      take,
    })
  }
}
