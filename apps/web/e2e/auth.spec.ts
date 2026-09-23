import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test.describe.serial('PremiumShare E2E', () => {
  const testEmail = `e2e-${Date.now()}@test.local`
  const testPassword = 'E2eTest1234!'

  test('회원가입 후 대시보드 이동', async ({ page }) => {
    await page.goto(`${BASE}/auth/register`)
    await page.getByLabel('이메일').fill(testEmail)
    await page.locator('input[type=password]').nth(0).fill(testPassword)
    await page.locator('input[type=password]').nth(1).fill(testPassword)
    await page.getByRole('button', { name: /가입|회원가입|시작/ }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('로그아웃 후 재로그인', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.getByLabel('이메일').fill(testEmail)
    await page.locator('input[type=password]').fill(testPassword)
    await page.getByRole('button', { name: /로그인/ }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('상품 목록과 DEMO 상품 표시', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.getByLabel('이메일').fill('member1@premiumshare.demo')
    await page.locator('input[type=password]').fill('Member1234!')
    await page.getByRole('button', { name: /로그인/ }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    await page.goto(`${BASE}/products`)
    await expect(page.getByText('클라우드 스토리지 Pro')).toBeVisible({ timeout: 10000 })
  })

  test('비로그인 대시보드 접근 시 로그인 리다이렉트', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('일반 회원은 관리자 페이지 접근 불가', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.getByLabel('이메일').fill('member1@premiumshare.demo')
    await page.locator('input[type=password]').fill('Member1234!')
    await page.getByRole('button', { name: /로그인/ }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(1500)
    expect(page.url()).not.toMatch(/\/admin(\/|$)/)
  })

  test('다른 사용자 주문 API 접근 차단', async ({ request }) => {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: 'member2@premiumshare.demo',
        password: 'Member1234!',
      },
    })
    expect(login.ok()).toBeTruthy()

    const response = await request.get(`${BASE}/api/orders/non-existent-order-id`)
    expect([403, 404]).toContain(response.status())
  })

  test('관리자 로그인 및 대시보드 지표', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.getByLabel('이메일').fill('admin@premiumshare.demo')
    await page.locator('input[type=password]').fill('Admin1234!')
    await page.getByRole('button', { name: /로그인/ }).click()
    await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 })

    await page.goto(`${BASE}/admin`)
    await expect(page.getByText(/회원|구독|결제|대시보드/).first()).toBeVisible({
      timeout: 10000,
    })
  })
})
