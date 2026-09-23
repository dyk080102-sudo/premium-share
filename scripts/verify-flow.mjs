/**
 * End-to-end API flow verification against a running PremiumShare instance.
 * Usage: node scripts/verify-flow.mjs
 */
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json, setCookie, ok: res.ok }
}

function pickCookie(setCookie) {
  return setCookie.map((c) => c.split(';')[0]).join('; ')
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  console.log(`Verifying PremiumShare at ${BASE}`)

  // 1) Public pages
  for (const path of ['/', '/products', '/auth/login', '/faq', '/terms', '/privacy']) {
    const res = await fetch(`${BASE}${path}`)
    assert(res.status === 200, `${path} expected 200, got ${res.status}`)
    console.log(`  ✓ GET ${path}`)
  }

  // 2) Products API
  const products = await req('/api/products')
  assert(products.ok, `products api failed: ${products.status}`)
  assert(Array.isArray(products.json.data?.products ?? products.json.products ?? products.json.data), 'products list missing')
  console.log('  ✓ GET /api/products')

  // 3) Member login
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'member1@premiumshare.demo',
      password: 'Member1234!',
    }),
  })
  assert(login.ok, `member login failed: ${login.status} ${JSON.stringify(login.json)}`)
  const memberCookie = pickCookie(login.setCookie)
  assert(memberCookie.includes('='), 'session cookie missing')
  console.log('  ✓ POST /api/auth/login (member1)')

  // 4) Member orders
  const orders = await req('/api/orders', { cookie: memberCookie })
  assert(orders.ok, `orders failed: ${orders.status}`)
  console.log('  ✓ GET /api/orders')

  // 5) Member cannot access admin dashboard API
  const adminDenied = await req('/api/admin/dashboard', { cookie: memberCookie })
  assert([401, 403].includes(adminDenied.status), `member admin access should be denied, got ${adminDenied.status}`)
  console.log('  ✓ member blocked from /api/admin/dashboard')

  // 6) Operator login + confirm pending payment path
  const opLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'operator@premiumshare.demo',
      password: 'Oper1234!',
    }),
  })
  assert(opLogin.ok, `operator login failed: ${opLogin.status}`)
  const opCookie = pickCookie(opLogin.setCookie)
  console.log('  ✓ POST /api/auth/login (operator)')

  const payments = await req('/api/admin/payments?status=PENDING', { cookie: opCookie })
  assert(payments.ok, `admin payments failed: ${payments.status} ${JSON.stringify(payments.json)}`)
  console.log('  ✓ GET /api/admin/payments')

  // 7) Admin login + dashboard
  const adminLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@premiumshare.demo',
      password: 'Admin1234!',
    }),
  })
  assert(adminLogin.ok, `admin login failed: ${adminLogin.status}`)
  const adminCookie = pickCookie(adminLogin.setCookie)
  const dash = await req('/api/admin/dashboard', { cookie: adminCookie })
  assert(dash.ok, `admin dashboard failed: ${dash.status} ${JSON.stringify(dash.json)}`)
  console.log('  ✓ GET /api/admin/dashboard')

  // 8) Register new user
  const email = `verify-${Date.now()}@test.local`
  const reg = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'Verify1234!' }),
  })
  assert(reg.status === 201 || reg.ok, `register failed: ${reg.status} ${JSON.stringify(reg.json)}`)
  console.log('  ✓ POST /api/auth/register')

  // 9) Create order for new user if demo product available
  const cookie = pickCookie(reg.setCookie)
  const productList = products.json.data?.products ?? products.json.products ?? products.json.data
  const demoProduct = (productList || []).find((p) => p.isActive || p.plans?.length)
  if (demoProduct) {
    const productDetail = await req(`/api/products/${demoProduct.id}`)
    const detail = productDetail.json.data ?? productDetail.json
    const plan = detail.plans?.[0] ?? demoProduct.plans?.[0]
    if (plan?.id) {
      const order = await req('/api/orders', {
        method: 'POST',
        cookie,
        body: JSON.stringify({
          planId: plan.id,
          idempotencyKey: `verify-order-${Date.now()}`,
        }),
      })
      assert(order.ok || order.status === 201, `create order failed: ${order.status} ${JSON.stringify(order.json)}`)
      const created = order.json.data ?? order.json
      console.log('  ✓ POST /api/orders')

      // DEMO payment simulate success
      const sim = await req('/api/demo/payment/simulate', {
        method: 'POST',
        cookie,
        body: JSON.stringify({
          orderId: created.id ?? created.order?.id,
          scenario: 'success',
        }),
      })
      if (sim.ok) {
        console.log('  ✓ POST /api/demo/payment/simulate (success)')
      } else {
        console.log(`  ! demo simulate skipped/failed: ${sim.status} ${JSON.stringify(sim.json)}`)
      }
    } else {
      console.log('  ! no plan found for order create')
    }
  } else {
    console.log('  ! no active product for order create')
  }

  console.log('\n✅ verify-flow completed')
}

main().catch((err) => {
  console.error('\n❌ verify-flow failed:', err.message)
  process.exit(1)
})
