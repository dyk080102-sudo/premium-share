import { chromium, type Page } from 'playwright'
import type { FamilyJob } from '@prisma/client'
import type { DriverResult, FamilyDriver } from './types'

/**
 * DEMO 전용: MOCK_FAMILY_ADMIN_URL 모의 관리 화면을 Playwright로 조작.
 * role/label 기반 — 실제 Google/YouTube 셀렉터 사용 금지.
 */
export class DemoFamilyDriver implements FamilyDriver {
  readonly name = 'demo'

  constructor(private mockUrl: string) {}

  async execute(job: FamilyJob): Promise<DriverResult> {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(this.mockUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      // 결제 필요 시나리오가 보이면 중단
      const paywall = page.getByRole('alert', { name: /결제 필요|payment required/i })
      if (await paywall.isVisible().catch(() => false)) {
        return {
          outcome: 'FAILED',
          errorCode: 'PLAN_NOT_ACTIVE',
          summary: '모의 화면: 유료 가입/결제 필요 — 자동화 중단',
          externalResult: { paywall: true },
        }
      }

      switch (job.type) {
        case 'INSPECT':
        case 'LINK_OR_CREATE_GROUP':
          return await this.inspectOrLink(page, job)
        case 'INVITE':
          return await this.invite(page, job)
        case 'REMOVE_MEMBER':
        case 'VERIFY_REMOVAL':
          return await this.remove(page, job)
        case 'SYNC_SLOTS':
        case 'VERIFY_MEMBERSHIP':
          return await this.inspectOrLink(page, job)
        case 'CANCEL_INVITE':
          return {
            outcome: 'AWAITING_HUMAN',
            errorCode: 'HUMAN_ACTION_REQUIRED',
            summary: 'DEMO: 초대 취소는 모의 UI에 별도 버튼 없음 — 수동 확인',
          }
        default:
          return {
            outcome: 'FAILED',
            errorCode: 'PRECONDITION_FAILED',
            summary: `DEMO driver: 미지원 작업 유형 ${job.type}`,
          }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        outcome: 'FAILED',
        errorCode: 'EXTERNAL_RESULT_UNKNOWN',
        summary: `DEMO Playwright 오류: ${message}`,
      }
    } finally {
      await browser.close()
    }
  }

  private async readMembers(page: Page) {
    const rows = page.getByRole('row').filter({ has: page.getByRole('cell') })
    const count = await rows.count()
    const members: NonNullable<DriverResult['observed']>['members'] = []

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i)
      const cells = row.getByRole('cell')
      const cellCount = await cells.count()
      if (cellCount < 2) continue
      const email = (await cells.nth(0).innerText()).trim()
      const kindText = (await cells.nth(1).innerText()).trim().toUpperCase()
      const statusText =
        cellCount > 2
          ? (await cells.nth(2).innerText()).trim().toUpperCase()
          : 'OBSERVED'
      if (!email.includes('@')) continue

      let kind: 'ADMIN' | 'MEMBER' | 'PENDING_INVITE' | 'UNMANAGED' = 'MEMBER'
      if (kindText.includes('ADMIN')) kind = 'ADMIN'
      else if (kindText.includes('PENDING') || kindText.includes('INVITE'))
        kind = 'PENDING_INVITE'
      else if (kindText.includes('UNMANAGED')) kind = 'UNMANAGED'

      let externalStatus:
        | 'OBSERVED'
        | 'INVITED'
        | 'JOINED'
        | 'REMOVAL_PENDING'
        | 'REMOVED'
        | 'UNKNOWN' = 'OBSERVED'
      if (statusText.includes('INVITED')) externalStatus = 'INVITED'
      else if (statusText.includes('JOINED')) externalStatus = 'JOINED'
      else if (statusText.includes('REMOVAL')) externalStatus = 'REMOVAL_PENDING'
      else if (statusText.includes('REMOVED')) externalStatus = 'REMOVED'

      members.push({ email, kind, externalStatus })
    }
    return members
  }

  private async inspectOrLink(page: Page, job: FamilyJob): Promise<DriverResult> {
    const groupKeyInput = page.getByLabel(/그룹 키|external group key/i)
    const hasGroup = await page
      .getByRole('status', { name: /그룹 연결됨|group linked/i })
      .isVisible()
      .catch(() => false)

    if (!hasGroup) {
      const createBtn = page.getByRole('button', {
        name: /그룹 생성|create group/i,
      })
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click()
        await page.waitForTimeout(300)
      }
    } else {
      const linkBtn = page.getByRole('button', {
        name: /그룹 연결|link group/i,
      })
      if (await linkBtn.isVisible().catch(() => false)) {
        await linkBtn.click()
        await page.waitForTimeout(200)
      }
    }

    // 결제 필요 버튼이 눌러진 상태 재확인
    if (
      await page
        .getByRole('alert', { name: /결제 필요/i })
        .isVisible()
        .catch(() => false)
    ) {
      return {
        outcome: 'FAILED',
        errorCode: 'PLAN_NOT_ACTIVE',
        summary: '모의 화면: 결제 필요 — 중단',
      }
    }

    const key =
      (await groupKeyInput.inputValue().catch(() => '')) ||
      `demo-group-${job.groupId.slice(0, 8)}`

    const capacityLabel = page.getByLabel(/정원|capacity/i)
    const capacityRaw = await capacityLabel.inputValue().catch(() => '6')
    const capacityTotal = parseInt(capacityRaw, 10) || 6

    const members = await this.readMembers(page)

    return {
      outcome: 'SUCCEEDED',
      summary: `DEMO 조회/연결 완료 (members=${members.length})`,
      observed: {
        externalGroupKey: key,
        planActiveConfirmed: true,
        capacityTotal,
        adminSeats: 1,
        members,
      },
      externalResult: { mockUrl: this.mockUrl, mode: 'DEMO' },
    }
  }

  private async invite(page: Page, job: FamilyJob): Promise<DriverResult> {
    if (!job.targetEmail) {
      return {
        outcome: 'FAILED',
        errorCode: 'PRECONDITION_FAILED',
        summary: '초대 대상 이메일 없음',
      }
    }

    await this.inspectOrLink(page, job)

    const emailInput = page.getByLabel(/초대 이메일|invite email/i)
    await emailInput.fill(job.targetEmail)
    await page.getByRole('button', { name: /초대 발송|send invite/i }).click()
    await page.waitForTimeout(400)

    // 목록 재확인
    const members = await this.readMembers(page)
    const found = members.find(
      (m) => m.email.toLowerCase() === job.targetEmail!.toLowerCase(),
    )
    if (!found) {
      return {
        outcome: 'EXTERNAL_RESULT_UNKNOWN',
        errorCode: 'EXTERNAL_RESULT_UNKNOWN',
        summary: '초대 클릭 후 목록에서 대상 이메일을 재확인하지 못함',
        observed: { members },
      }
    }

    return {
      outcome: 'SUCCEEDED',
      summary: `DEMO 초대 발송 후 목록 확인: ${job.targetEmail}`,
      observed: {
        planActiveConfirmed: true,
        members,
      },
      externalResult: { invited: job.targetEmail },
    }
  }

  private async remove(page: Page, job: FamilyJob): Promise<DriverResult> {
    if (!job.targetEmail) {
      return {
        outcome: 'FAILED',
        errorCode: 'PRECONDITION_FAILED',
        summary: '제거 대상 이메일 없음',
      }
    }

    await this.inspectOrLink(page, job)

    const row = page
      .getByRole('row')
      .filter({ hasText: job.targetEmail })
      .first()
    if (!(await row.isVisible().catch(() => false))) {
      return {
        outcome: 'EXTERNAL_RESULT_UNKNOWN',
        errorCode: 'TARGET_AMBIGUOUS',
        summary: `목록에서 ${job.targetEmail}을(를) 찾지 못함`,
      }
    }

    await row.getByRole('button', { name: /제거|remove/i }).click()
    await page.waitForTimeout(400)

    const members = await this.readMembers(page)
    const stillThere = members.find(
      (m) =>
        m.email.toLowerCase() === job.targetEmail!.toLowerCase() &&
        m.externalStatus !== 'REMOVED',
    )
    if (stillThere) {
      return {
        outcome: 'EXTERNAL_RESULT_UNKNOWN',
        errorCode: 'EXTERNAL_RESULT_UNKNOWN',
        summary: '제거 클릭 후 목록에서 여전히 활성으로 보임',
        observed: { members },
      }
    }

    return {
      outcome: 'SUCCEEDED',
      summary: `DEMO 제거 후 목록 재확인: ${job.targetEmail}`,
      observed: { members },
      externalResult: { removed: job.targetEmail },
    }
  }
}
