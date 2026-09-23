import { test, expect } from '@playwright/test'

/**
 * Mock Family Admin + DEMO driver 조작 흐름.
 * MOCK_FAMILY_ADMIN_URL (기본 http://127.0.0.1:3100) 이 떠 있어야 함.
 * 실 Google/YouTube UI가 아님.
 */
const mockUrl = process.env.MOCK_FAMILY_ADMIN_URL ?? 'http://127.0.0.1:3100'

test.describe('DEMO mock family admin', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    try {
      const res = await page.request.get(`${mockUrl}/health`)
      if (!res.ok()) {
        testInfo.skip(true, 'mock-family-admin not running')
      }
    } catch {
      testInfo.skip(true, 'mock-family-admin not reachable')
    }
  })

  test('그룹 생성 후 초대·목록 재확인', async ({ page }) => {
    await page.goto(mockUrl)
    await expect(page.getByText('Mock Family Admin')).toBeVisible()

    await page.getByRole('button', { name: '그룹 생성' }).click()
    await expect(page.getByRole('status', { name: '그룹 연결됨' })).toBeVisible()

    await page.getByLabel('초대 이메일').fill('demo-member@example.com')
    await page.getByRole('button', { name: '초대 발송' }).click()

    await expect(
      page.getByRole('row').filter({ hasText: 'demo-member@example.com' }),
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: 'PENDING_INVITE' }),
    ).toBeVisible()
  })

  test('결제 필요 시나리오는 alert 표시', async ({ page }) => {
    await page.goto(mockUrl)
    await page.getByRole('button', { name: '결제 필요 시나리오' }).click()
    await expect(page.getByRole('alert', { name: '결제 필요' })).toBeVisible()
  })

  test('제거 후 목록에서 사라짐', async ({ page }) => {
    await page.goto(mockUrl)
    await page.getByRole('button', { name: '그룹 생성' }).click()
    await page.getByLabel('초대 이메일').fill('remove-me@example.com')
    await page.getByRole('button', { name: '초대 발송' }).click()

    const row = page.getByRole('row').filter({ hasText: 'remove-me@example.com' })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: '제거' }).click()
    await expect(row).toHaveCount(0)
  })
})
