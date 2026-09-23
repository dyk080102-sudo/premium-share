/**
 * Family Runner - 패밀리 그룹 자동화 폴링 루프
 * 기존 apps/family-runner/src/index.ts 에서 가져온 로직을 startFamilyRunner() 함수로 모듈화.
 * unified server (server.ts) 에서 Next.js와 함께 단일 프로세스로 실행됩니다.
 */
import {
  PrismaClient,
  FamilyAutomationMode,
  FamilyJobType,
  FamilyMemberKind,
  FamilyErrorCode,
} from '@prisma/client'
import {
  FamilyJobService,
  FamilySyncService,
  FamilyRemovalService,
  FamilySheetsService,
  FamilyGateService,
} from '@premium-share/domain'

// 드라이버는 family-runner 앱의 상대 경로로 참조
import { DemoFamilyDriver } from '../../../family-runner/src/drivers/demo.driver'
import { AssistedFamilyDriver } from '../../../family-runner/src/drivers/assisted.driver'
import { AuthorizedFamilyDriver } from '../../../family-runner/src/drivers/authorized.driver'
import type { DriverResult, FamilyDriver } from '../../../family-runner/src/drivers/types'

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function pickDriver(mode: FamilyAutomationMode, mockAdminUrl: string): FamilyDriver {
  if (mode === FamilyAutomationMode.AUTHORIZED_BROWSER) {
    return new AuthorizedFamilyDriver()
  }
  if (mode === FamilyAutomationMode.ASSISTED) {
    return new AssistedFamilyDriver()
  }
  return new DemoFamilyDriver(mockAdminUrl)
}

export function startFamilyRunner(prisma: PrismaClient) {
  const workerId = process.env.FAMILY_RUNNER_ID ?? 'unified-family-runner-1'
  const pollMs = parseInt(process.env.FAMILY_RUNNER_POLL_MS ?? '3000', 10)
  /**
   * DEMO 모드에서 mock-admin UI 는 이제 같은 Next.js 서버에서 /mock-admin/ 경로로 서비스됩니다.
   * 기본값도 동일 포트를 바라보도록 변경.
   */
  const port = process.env.PORT ?? '3000'
  const mockAdminUrl =
    process.env.MOCK_FAMILY_ADMIN_URL ?? `http://127.0.0.1:${port}/mock-admin/`
  const defaultMode = (process.env.FAMILY_AUTOMATION_MODE ?? 'DEMO') as FamilyAutomationMode

  const jobs = new FamilyJobService(prisma)
  const sync = new FamilySyncService(prisma)
  const removal = new FamilyRemovalService(prisma)
  const sheets = new FamilySheetsService(prisma)
  const gate = new FamilyGateService(prisma)

  async function applyObserved(groupId: string, result: DriverResult) {
    const obs = result.observed
    if (!obs) return

    const members = (obs.members ?? []).map((m) => ({
      email: m.email,
      displayName: m.displayName,
      kind: m.kind as FamilyMemberKind,
      externalStatus: m.externalStatus,
    }))

    await sync.applyExternalSnapshot({
      groupId,
      members,
      capacityTotal: obs.capacityTotal ?? undefined,
      adminSeats: obs.adminSeats,
      planActiveConfirmed: obs.planActiveConfirmed,
      externalGroupKey: obs.externalGroupKey,
    })
  }

  async function upsertPendingInvite(
    groupId: string,
    email: string,
    allocationId?: string | null,
  ) {
    const link = await prisma.familyGroupLink.findUnique({
      where: { subscriptionGroupId: groupId },
    })
    if (!link) return
    await prisma.familyExternalMember.upsert({
      where: {
        linkId_email_kind: {
          linkId: link.id,
          email: email.toLowerCase(),
          kind: FamilyMemberKind.PENDING_INVITE,
        },
      },
      create: {
        linkId: link.id,
        email: email.toLowerCase(),
        kind: FamilyMemberKind.PENDING_INVITE,
        externalStatus: 'INVITED',
        allocationId: allocationId ?? undefined,
        managedByUs: true,
        observedAt: new Date(),
      },
      update: {
        externalStatus: 'INVITED',
        allocationId: allocationId ?? undefined,
        managedByUs: true,
        observedAt: new Date(),
      },
    })
  }

  async function processOne(): Promise<boolean> {
    if (await gate.isEmergencyStopped()) {
      console.log('[family-runner] emergency stop active — skip poll')
      return false
    }

    const job = await jobs.claimNext(workerId)
    if (!job) return false

    console.log(`[family-runner] claimed ${job.id} type=${job.type} mode=${job.mode}`)
    await jobs.markInProgress(job.id, workerId)

    const driver = pickDriver(job.mode, mockAdminUrl)
    if (driver.supports && !driver.supports(job.type)) {
      await jobs.fail(
        job.id,
        FamilyErrorCode.PRECONDITION_FAILED,
        `Driver ${driver.name} does not support ${job.type}`,
      )
      return true
    }

    const result: DriverResult = await driver.execute(job)

    if (result.outcome === 'SUCCEEDED') {
      if (
        job.mode === FamilyAutomationMode.DEMO &&
        result.observed &&
        (job.type === FamilyJobType.INSPECT ||
          job.type === FamilyJobType.LINK_OR_CREATE_GROUP ||
          job.type === FamilyJobType.SYNC_SLOTS ||
          job.type === FamilyJobType.VERIFY_MEMBERSHIP)
      ) {
        await applyObserved(job.groupId, result)
      }

      if (
        job.mode === FamilyAutomationMode.DEMO &&
        job.type === FamilyJobType.REMOVE_MEMBER &&
        job.targetEmail &&
        result.externalResult?.removed
      ) {
        try {
          await removal.confirmRemovalVerified({
            groupId: job.groupId,
            targetEmail: job.targetEmail,
            allocationId: job.allocationId ?? undefined,
          })
        } catch (e) {
          console.warn('[family-runner] confirmRemovalVerified:', e)
        }
      }

      if (
        job.mode === FamilyAutomationMode.DEMO &&
        job.type === FamilyJobType.INVITE &&
        job.targetEmail
      ) {
        await upsertPendingInvite(job.groupId, job.targetEmail, job.allocationId)
      }

      await jobs.complete(job.id, {
        observedAt: new Date(),
        afterJson: result.observed ?? undefined,
        externalResultJson: result.externalResult,
        resultSummary: result.summary,
      })

      await sheets.emitEvent({
        eventType: 'JOB_SUCCEEDED',
        groupId: job.groupId,
        payload: {
          jobId: job.id,
          type: job.type,
          summary: result.summary,
          runnerId: workerId,
        },
      })
    } else if (result.outcome === 'AWAITING_HUMAN') {
      await jobs.awaitHuman(
        job.id,
        result.summary,
        result.errorCode ?? FamilyErrorCode.HUMAN_ACTION_REQUIRED,
      )
      await sheets.emitEvent({
        eventType: 'JOB_AWAITING_HUMAN',
        groupId: job.groupId,
        payload: {
          jobId: job.id,
          type: job.type,
          summary: result.summary,
          runnerId: workerId,
        },
      })
    } else if (result.outcome === 'EXTERNAL_RESULT_UNKNOWN') {
      await jobs.complete(job.id, {
        status: 'EXTERNAL_RESULT_UNKNOWN',
        resultSummary: result.summary,
        externalResultJson: result.externalResult,
        observedAt: new Date(),
      })
    } else {
      await jobs.fail(
        job.id,
        result.errorCode ?? FamilyErrorCode.EXTERNAL_RESULT_UNKNOWN,
        result.summary,
        result.externalResult,
      )
      await sheets.emitEvent({
        eventType: 'JOB_FAILED',
        groupId: job.groupId,
        payload: {
          jobId: job.id,
          type: job.type,
          summary: result.summary,
          errorCode: result.errorCode,
          runnerId: workerId,
        },
      })
    }

    return true
  }

  async function loop() {
    console.log(`[family-runner] starting worker=${workerId} defaultMode=${defaultMode}`)
    console.log(`[family-runner] MOCK_FAMILY_ADMIN_URL=${mockAdminUrl}`)
    console.log(
      `[family-runner] AUTHORIZED_BROWSER_ENABLED=${process.env.AUTHORIZED_BROWSER_ENABLED ?? 'false'}`,
    )

    for (;;) {
      try {
        const worked = await processOne()
        if (!worked) await sleep(pollMs)
      } catch (err) {
        console.error('[family-runner] poll error', err)
        await sleep(pollMs)
      }
    }
  }

  // 비동기 폴링 루프 시작 (에러는 로그만 남기고 서버는 계속 동작)
  loop().catch((e) => {
    console.error('[family-runner] fatal error:', e)
  })
}
