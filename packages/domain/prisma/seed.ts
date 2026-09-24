import { PrismaClient, UserRole, ReviewStatus, AllocationStatus } from '@prisma/client'
import argon2 from 'argon2'

const prisma = new PrismaClient()

async function hashPw(pw: string) {
  return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 })
}

async function main() {
  console.log('🌱 Starting seed...')

  // ── POLICY VERSIONS ──────────────────────────────────────────────────────
  await prisma.policyVersion.upsert({
    where: { type_version: { type: 'TERMS', version: '1.0' } },
    create: {
      type: 'TERMS',
      version: '1.0',
      content: '# 이용약관\n\n본 이용약관은 PremiumShare 서비스 이용에 관한 사항을 규정합니다.\n\n## 제1조 목적\n이 약관은 PremiumShare(이하 "회사")가 제공하는 구독 슬롯 공유 서비스의 이용조건 및 절차, 회사와 이용자의 권리, 의무, 책임사항 등을 규정합니다.',
      effectiveAt: new Date('2024-01-01'),
    },
    update: {},
  })

  await prisma.policyVersion.upsert({
    where: { type_version: { type: 'PRIVACY', version: '1.0' } },
    create: {
      type: 'PRIVACY',
      version: '1.0',
      content: '# 개인정보처리방침\n\nPremiumShare는 개인정보보호법에 따라 이용자의 개인정보를 보호하고 이와 관련한 불만을 원활하게 처리할 수 있도록 개인정보처리방침을 수립·공개합니다.',
      effectiveAt: new Date('2024-01-01'),
    },
    update: {},
  })

  // ── USERS ─────────────────────────────────────────────────────────────────
  const users = [
    { email: 'admin@premiumshare.demo', password: 'Admin1234!', role: UserRole.SUPER_ADMIN },
    { email: 'operator@premiumshare.demo', password: 'Oper1234!', role: UserRole.OPERATOR },
    { email: 'support@premiumshare.demo', password: 'Supp1234!', role: UserRole.SUPPORT },
    { email: 'member1@premiumshare.demo', password: 'Member1234!', role: UserRole.MEMBER },
    { email: 'member2@premiumshare.demo', password: 'Member1234!', role: UserRole.MEMBER },
  ]

  const createdUsers: Record<string, string> = {}
  for (const u of users) {
    const ph = await hashPw(u.password)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, passwordHash: ph, role: u.role },
      update: { role: u.role, isActive: true },
    })
    createdUsers[u.email] = user.id
    console.log(`  ✓ User: ${u.email} (${u.role})`)
  }

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  const products = [
    {
      key: 'cloud-storage',
      name: '클라우드 스토리지 Pro',
      description: '고용량 클라우드 저장 공간을 저렴하게 이용하세요. 가족 플랜 슬롯을 공유합니다.',
      serviceType: '클라우드 스토리지',
      shareMethod: '가족 초대',
      countryCodes: ['KR'],
      reviewStatus: ReviewStatus.APPROVED,
      isActive: true,
      maxSlotsPerGroup: 5,
      eligibilityInfo: '만 19세 이상 내국인 또는 외국인등록증 소지자',
      onboardingGuide: '1. 초대 이메일 수락\n2. 계정 설정 완료\n3. 공유 폴더 접근',
    },
    {
      key: 'streaming-plus',
      name: '스트리밍 콘텐츠 플러스',
      description: '국내외 최신 영화, 드라마, 다큐멘터리를 4K 화질로 즐기세요.',
      serviceType: '스트리밍 서비스',
      shareMethod: '프로필 공유',
      countryCodes: ['KR'],
      reviewStatus: ReviewStatus.APPROVED,
      isActive: true,
      maxSlotsPerGroup: 4,
      eligibilityInfo: '국내 서비스 이용 가능 지역 거주자',
      onboardingGuide: '1. 공유 프로필 설정\n2. PIN 번호 설정\n3. 다운로드 품질 설정',
    },
    {
      key: 'music-pass',
      name: '프리미엄 뮤직 패스',
      description: '광고 없는 음악 스트리밍과 오프라인 저장 기능을 이용하세요.',
      serviceType: '음악 스트리밍',
      shareMethod: '가족 계정',
      countryCodes: ['KR'],
      reviewStatus: ReviewStatus.APPROVED,
      isActive: true,
      maxSlotsPerGroup: 6,
      eligibilityInfo: '만 13세 이상 이용 가능',
      onboardingGuide: '1. 가족 초대 수락\n2. 개인 플레이리스트 설정',
    },
    {
      key: 'pending-product',
      name: '실제브랜드 예시 (검토중)',
      description: '현재 서비스 검토 중입니다.',
      serviceType: '기타',
      shareMethod: '미정',
      countryCodes: ['KR'],
      reviewStatus: ReviewStatus.PENDING,
      isActive: false,
      maxSlotsPerGroup: 4,
    },
  ]

  const createdProducts: Record<string, string> = {}
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { id: `seed-${p.key}` },
      create: {
        id: `seed-${p.key}`,
        name: p.name,
        description: p.description,
        serviceType: p.serviceType,
        shareMethod: p.shareMethod,
        countryCodes: p.countryCodes ?? ['KR'],
        reviewStatus: p.reviewStatus,
        isActive: p.isActive,
        maxSlotsPerGroup: p.maxSlotsPerGroup,
        eligibilityInfo: p.eligibilityInfo,
        onboardingGuide: p.onboardingGuide,
        sortOrder: Object.keys(createdProducts).length,
        reviewedAt: p.reviewStatus === ReviewStatus.APPROVED ? new Date() : undefined,
        reviewedBy: p.reviewStatus === ReviewStatus.APPROVED ? createdUsers['admin@premiumshare.demo'] : undefined,
      },
      update: {
        reviewStatus: p.reviewStatus,
        isActive: p.isActive,
        name: p.name,
      },
    })
    createdProducts[p.key] = product.id
    console.log(`  ✓ Product: ${p.name}`)
  }

  // ── PLANS ──────────────────────────────────────────────────────────────────
  const planDefs = [
    { productKey: 'cloud-storage', name: '1개월', durationDays: 30, priceKrw: 3900 },
    { productKey: 'cloud-storage', name: '3개월', durationDays: 90, priceKrw: 10500 },
    { productKey: 'cloud-storage', name: '1년', durationDays: 365, priceKrw: 39000 },
    { productKey: 'streaming-plus', name: '1개월', durationDays: 30, priceKrw: 4500 },
    { productKey: 'streaming-plus', name: '3개월', durationDays: 90, priceKrw: 12000 },
    { productKey: 'music-pass', name: '1개월', durationDays: 30, priceKrw: 2900 },
    { productKey: 'music-pass', name: '3개월', durationDays: 90, priceKrw: 7800 },
    { productKey: 'music-pass', name: '1년', durationDays: 365, priceKrw: 29000 },
  ]

  const createdPlans: Record<string, string> = {}
  for (const plan of planDefs) {
    const key = `seed-plan-${plan.productKey}-${plan.durationDays}`
    const p = await prisma.plan.upsert({
      where: { id: key },
      create: {
        id: key,
        productId: createdProducts[plan.productKey],
        name: plan.name,
        durationDays: plan.durationDays,
        priceKrw: plan.priceKrw,
        isActive: true,
        sortOrder: planDefs.indexOf(plan),
      },
      update: { priceKrw: plan.priceKrw, isActive: true },
    })
    createdPlans[key] = p.id
  }
  console.log(`  ✓ Plans: ${planDefs.length} plans created`)

  // ── OWNER ACCOUNTS ──────────────────────────────────────────────────────────
  const ownerAccount = await prisma.ownerAccount.upsert({
    where: { id: 'seed-owner-1' },
    create: {
      id: 'seed-owner-1',
      email: 'owner-cloud@example.demo',
      serviceType: '클라우드 스토리지',
      country: 'KR',
      status: 'AVAILABLE',
      verifiedAt: new Date(),
      notes: '시드 데이터 - 검증된 계정',
    },
    update: { status: 'AVAILABLE' },
  })

  const ownerAccount2 = await prisma.ownerAccount.upsert({
    where: { id: 'seed-owner-2' },
    create: {
      id: 'seed-owner-2',
      email: 'owner-stream@example.demo',
      serviceType: '스트리밍 서비스',
      country: 'KR',
      status: 'AVAILABLE',
      verifiedAt: new Date(),
    },
    update: {},
  })

  // ── SUBSCRIPTION GROUPS ─────────────────────────────────────────────────────
  // Group 1: Available slots (cloud)
  const group1 = await prisma.subscriptionGroup.upsert({
    where: { id: 'seed-group-available' },
    create: {
      id: 'seed-group-available',
      productId: createdProducts['cloud-storage'],
      ownerAccountId: ownerAccount.id,
      country: 'KR',
      totalCapacity: 5,
      adminSlotsReserved: 1,
      name: '클라우드 Pro 그룹 A',
      supplyPaymentStatus: 'ACTIVE',
      supplyNextRenewalAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      policyVerified: true,
    },
    update: { status: 'ACTIVE', policyVerified: true },
  })

  // Create slots for group 1
  for (let i = 0; i < 5; i++) {
    await prisma.slot.upsert({
      where: { groupId_slotIndex: { groupId: group1.id, slotIndex: i } },
      create: { groupId: group1.id, slotIndex: i },
      update: {},
    })
  }

  // Group 2: Full group (streaming)
  const group2 = await prisma.subscriptionGroup.upsert({
    where: { id: 'seed-group-full' },
    create: {
      id: 'seed-group-full',
      productId: createdProducts['streaming-plus'],
      ownerAccountId: ownerAccount2.id,
      country: 'KR',
      totalCapacity: 4,
      adminSlotsReserved: 0,
      name: '스트리밍 플러스 그룹 B',
      supplyPaymentStatus: 'ACTIVE',
      status: 'ACTIVE',
      policyVerified: true,
    },
    update: {},
  })

  for (let i = 0; i < 4; i++) {
    await prisma.slot.upsert({
      where: { groupId_slotIndex: { groupId: group2.id, slotIndex: i } },
      create: { groupId: group2.id, slotIndex: i },
      update: {},
    })
  }

  // Group 3: Suspended
  const group3 = await prisma.subscriptionGroup.upsert({
    where: { id: 'seed-group-suspended' },
    create: {
      id: 'seed-group-suspended',
      productId: createdProducts['music-pass'],
      ownerAccountId: ownerAccount.id,
      country: 'KR',
      totalCapacity: 6,
      adminSlotsReserved: 0,
      name: '뮤직 패스 그룹 C (중단)',
      supplyPaymentStatus: 'SUSPENDED',
      status: 'SUSPENDED',
      policyVerified: false,
      operatorNotes: '운영자 계정 갱신 실패로 임시 중단',
    },
    update: {},
  })

  console.log('  ✓ Groups and slots created')

  // ── SCENARIO: member1 - pending payment order ──────────────────────────────
  const member1Id = createdUsers['member1@premiumshare.demo']
  const member2Id = createdUsers['member2@premiumshare.demo']

  const pendingOrder = await prisma.order.upsert({
    where: { idempotencyKey: 'seed-order-pending-1' },
    create: {
      idempotencyKey: 'seed-order-pending-1',
      userId: member1Id,
      planId: `seed-plan-cloud-storage-30`,
      productId: createdProducts['cloud-storage'],
      productNameSnapshot: '클라우드 스토리지 Pro',
      planNameSnapshot: '1개월',
      durationDaysSnapshot: 30,
      priceKrwSnapshot: 3900,
      status: 'PENDING_PAYMENT',
      source: 'MANUAL',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    update: {},
  })

  // Create payment for pending order
  await prisma.payment.upsert({
    where: { idempotencyKey: 'seed-payment-pending-1' },
    create: {
      idempotencyKey: 'seed-payment-pending-1',
      orderId: pendingOrder.id,
      amountKrw: 3900,
      status: 'PENDING',
      source: 'MANUAL',
    },
    update: {},
  })

  console.log('  ✓ Scenario: member1 pending payment order')

  // ── SCENARIO: member1 - active subscription ───────────────────────────────
  const activeOrder = await prisma.order.upsert({
    where: { idempotencyKey: 'seed-order-active-1' },
    create: {
      idempotencyKey: 'seed-order-active-1',
      userId: member1Id,
      planId: `seed-plan-streaming-plus-30`,
      productId: createdProducts['streaming-plus'],
      productNameSnapshot: '스트리밍 콘텐츠 플러스',
      planNameSnapshot: '1개월',
      durationDaysSnapshot: 30,
      priceKrwSnapshot: 4500,
      status: 'CONFIRMED',
      source: 'DEMO',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {},
  })

  const activePayment = await prisma.payment.upsert({
    where: { idempotencyKey: 'seed-payment-active-1' },
    create: {
      idempotencyKey: 'seed-payment-active-1',
      orderId: activeOrder.id,
      amountKrw: 4500,
      status: 'CONFIRMED',
      source: 'DEMO',
      confirmedAt: new Date(),
      confirmedBy: createdUsers['admin@premiumshare.demo'],
    },
    update: {},
  })

  const now = new Date()
  const activeSubExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const activeSub = await prisma.subscription.upsert({
    where: { id: 'seed-sub-active-1' },
    create: {
      id: 'seed-sub-active-1',
      userId: member1Id,
      orderId: activeOrder.id,
      productId: createdProducts['streaming-plus'],
      planId: `seed-plan-streaming-plus-30`,
      status: 'ACTIVE',
      startedAt: now,
      expiresAt: activeSubExpiry,
      currentPeriodStart: now,
      currentPeriodEnd: activeSubExpiry,
    },
    update: {},
  })

  // Allocate slot for active subscription
  const group2Slots = await prisma.slot.findMany({ where: { groupId: group2.id } })
  const slot0 = group2Slots[0]
  if (slot0) {
    const alloc = await prisma.allocation.upsert({
      where: { id: 'seed-alloc-active-1' },
      create: {
        id: 'seed-alloc-active-1',
        slotId: slot0.id,
        subscriptionId: activeSub.id,
        status: AllocationStatus.ACTIVE,
        activatedAt: now,
      },
      update: {},
    })

    await prisma.invitation.upsert({
      where: { id: 'seed-invite-active-1' },
      create: {
        id: 'seed-invite-active-1',
        allocationId: alloc.id,
        subscriptionId: activeSub.id,
        inviteEmail: 'member1@premiumshare.demo',
        status: 'ACTIVATED',
        sentAt: now,
        sentBy: createdUsers['operator@premiumshare.demo'],
        acceptedReportedAt: now,
        activatedAt: now,
        activatedBy: createdUsers['operator@premiumshare.demo'],
      },
      update: {},
    })
  }

  console.log('  ✓ Scenario: member1 active subscription')

  // ── SCENARIO: member2 - waiting for invitation ─────────────────────────────
  const waitingOrder = await prisma.order.upsert({
    where: { idempotencyKey: 'seed-order-waiting-1' },
    create: {
      idempotencyKey: 'seed-order-waiting-1',
      userId: member2Id,
      planId: `seed-plan-cloud-storage-30`,
      productId: createdProducts['cloud-storage'],
      productNameSnapshot: '클라우드 스토리지 Pro',
      planNameSnapshot: '1개월',
      durationDaysSnapshot: 30,
      priceKrwSnapshot: 3900,
      status: 'CONFIRMED',
      source: 'DEMO',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {},
  })

  const waitingSub = await prisma.subscription.upsert({
    where: { id: 'seed-sub-waiting-1' },
    create: {
      id: 'seed-sub-waiting-1',
      userId: member2Id,
      orderId: waitingOrder.id,
      productId: createdProducts['cloud-storage'],
      planId: `seed-plan-cloud-storage-30`,
      status: 'WAITING',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {},
  })

  // Allocate slot (invited status)
  const group1Slots = await prisma.slot.findMany({ where: { groupId: group1.id } })
  const slot1 = group1Slots.find((s) => s.slotIndex === 1)
  if (slot1) {
    const alloc2 = await prisma.allocation.upsert({
      where: { id: 'seed-alloc-waiting-1' },
      create: {
        id: 'seed-alloc-waiting-1',
        slotId: slot1.id,
        subscriptionId: waitingSub.id,
        status: AllocationStatus.INVITED,
      },
      update: {},
    })

    await prisma.invitation.upsert({
      where: { id: 'seed-invite-waiting-1' },
      create: {
        id: 'seed-invite-waiting-1',
        allocationId: alloc2.id,
        subscriptionId: waitingSub.id,
        inviteEmail: 'member2@premiumshare.demo',
        status: 'SENT',
        sentAt: now,
        sentBy: createdUsers['operator@premiumshare.demo'],
      },
      update: {},
    })

    await prisma.operationTask.upsert({
      where: { id: 'seed-task-activate-1' },
      create: {
        id: 'seed-task-activate-1',
        type: 'INVITE_ACTIVATE',
        subscriptionId: waitingSub.id,
        invitationId: 'seed-invite-waiting-1',
        priority: 6,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'PENDING',
      },
      update: {},
    })
  }

  console.log('  ✓ Scenario: member2 waiting for invitation confirmation')

  // ── SCENARIO: D-3 expiring subscription ───────────────────────────────────
  const expiringDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const expiringOrder = await prisma.order.upsert({
    where: { idempotencyKey: 'seed-order-expiring-1' },
    create: {
      idempotencyKey: 'seed-order-expiring-1',
      userId: member1Id,
      planId: `seed-plan-music-pass-30`,
      productId: createdProducts['music-pass'],
      productNameSnapshot: '프리미엄 뮤직 패스',
      planNameSnapshot: '1개월',
      durationDaysSnapshot: 30,
      priceKrwSnapshot: 2900,
      status: 'CONFIRMED',
      source: 'DEMO',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    update: {},
  })

  await prisma.subscription.upsert({
    where: { id: 'seed-sub-expiring-1' },
    create: {
      id: 'seed-sub-expiring-1',
      userId: member1Id,
      orderId: expiringOrder.id,
      productId: createdProducts['music-pass'],
      planId: `seed-plan-music-pass-30`,
      status: 'EXPIRING',
      startedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
      expiresAt: expiringDate,
      currentPeriodStart: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: expiringDate,
    },
    update: {},
  })

  console.log('  ✓ Scenario: D-3 expiring subscription')

  // ── SCENARIO: Refund in REVIEWING state ─────────────────────────────────────
  const refundOrder = await prisma.order.upsert({
    where: { idempotencyKey: 'seed-order-refund-1' },
    create: {
      idempotencyKey: 'seed-order-refund-1',
      userId: member2Id,
      planId: `seed-plan-cloud-storage-90`,
      productId: createdProducts['cloud-storage'],
      productNameSnapshot: '클라우드 스토리지 Pro',
      planNameSnapshot: '3개월',
      durationDaysSnapshot: 90,
      priceKrwSnapshot: 10500,
      status: 'CONFIRMED',
      source: 'DEMO',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    update: {},
  })

  const refundPayment = await prisma.payment.upsert({
    where: { idempotencyKey: 'seed-payment-refund-1' },
    create: {
      idempotencyKey: 'seed-payment-refund-1',
      orderId: refundOrder.id,
      amountKrw: 10500,
      status: 'CONFIRMED',
      source: 'DEMO',
      confirmedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      confirmedBy: createdUsers['admin@premiumshare.demo'],
    },
    update: {},
  })

  await prisma.refund.upsert({
    where: { id: 'seed-refund-reviewing-1' },
    create: {
      id: 'seed-refund-reviewing-1',
      userId: member2Id,
      orderId: refundOrder.id,
      paymentId: refundPayment.id,
      requestedAmountKrw: 8000,
      status: 'REVIEWING',
      reason: '서비스 이용 불편',
      requestNotes: '초대가 오지 않아 서비스를 이용하지 못했습니다.',
      source: 'DEMO',
    },
    update: {},
  })

  console.log('  ✓ Scenario: refund in REVIEWING state')

  // ── FAQ ───────────────────────────────────────────────────────────────────
  const faqs = [
    {
      category: '서비스 이용',
      question: '구독 슬롯 공유란 무엇인가요?',
      answer: '구독 슬롯 공유는 하나의 프리미엄 계정에서 제공하는 여러 개의 이용 자리(슬롯) 중 하나를 이용하는 서비스입니다. 정식 공유 기능을 활용하므로 이용약관에 위배되지 않습니다.',
    },
    {
      category: '결제',
      question: '결제 후 얼마나 걸리나요?',
      answer: '데모 모드에서는 즉시 처리됩니다. 실제 계좌이체 모드에서는 입금 확인 후 1-2 영업일 내에 슬롯이 배정됩니다.',
    },
    {
      category: '구독 관리',
      question: '만료 전에 갱신하면 기간이 연장되나요?',
      answer: '네, 현재 구독 만료일 이후부터 새로운 기간이 시작됩니다. 만료 전에 갱신하시면 이용 공백 없이 서비스를 계속 이용하실 수 있습니다.',
    },
    {
      category: '환불',
      question: '환불은 어떻게 신청하나요?',
      answer: '주문 상세 페이지 또는 마이페이지에서 환불 신청이 가능합니다. 이용 일수에 비례하여 환불 금액이 계산됩니다.',
    },
    {
      category: '보안',
      question: '비밀번호는 안전하게 관리되나요?',
      answer: '네, 운영자 계정의 비밀번호는 저장하지 않으며, 초대 방식으로만 서비스를 제공합니다. 회원님의 계정 정보는 Argon2id 알고리즘으로 안전하게 암호화됩니다.',
    },
  ]

  for (let i = 0; i < faqs.length; i++) {
    await prisma.faq.upsert({
      where: { id: `seed-faq-${i + 1}` },
      create: { id: `seed-faq-${i + 1}`, ...faqs[i], sortOrder: i, isActive: true },
      update: { ...faqs[i] },
    })
  }
  console.log(`  ✓ FAQ: ${faqs.length} items`)

  // ── ANNOUNCEMENT ──────────────────────────────────────────────────────────
  await prisma.announcement.upsert({
    where: { id: 'seed-announce-1' },
    create: {
      id: 'seed-announce-1',
      title: '🎉 PremiumShare 서비스 오픈!',
      content: '안전하고 투명한 구독 공유 플랫폼 PremiumShare가 오픈했습니다. 데모 모드에서 무료로 체험해보세요.',
      isActive: true,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {},
  })
  console.log('  ✓ Announcement created')

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  await prisma.notification.upsert({
    where: { id: 'seed-notif-1' },
    create: {
      id: 'seed-notif-1',
      userId: member1Id,
      type: 'WELCOME',
      title: '환영합니다!',
      message: 'PremiumShare에 가입하신 것을 환영합니다. 지금 바로 상품을 둘러보세요.',
      isRead: false,
    },
    update: {},
  })

  await prisma.notification.upsert({
    where: { id: 'seed-notif-2' },
    create: {
      id: 'seed-notif-2',
      userId: member2Id,
      type: 'INVITATION_SENT',
      title: '초대가 발송되었습니다',
      message: 'member2@premiumshare.demo로 초대 이메일이 발송되었습니다. 확인 후 수락해주세요.',
      isRead: false,
    },
    update: {},
  })

  // ── APP SETTINGS ──────────────────────────────────────────────────────────
  const settings = [
    { key: 'site.name', value: 'PremiumShare', description: '사이트 이름' },
    { key: 'order.expire_hours', value: '24', description: '주문 만료 시간 (시간)' },
    { key: 'login.max_attempts', value: '5', description: '최대 로그인 시도 횟수' },
    { key: 'login.lock_minutes', value: '15', description: '계정 잠금 시간 (분)' },
    { key: 'bank.name', value: '국민은행', description: '입금 은행명' },
    { key: 'bank.account', value: '000-0000-0000', description: '입금 계좌번호' },
    { key: 'bank.account_holder', value: '(주)프리미엄쉐어', description: '예금주' },
  ]

  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      create: { ...s, updatedBy: createdUsers['admin@premiumshare.demo'] },
      update: {},
    })
  }
  await prisma.appSetting.upsert({
    where: { key: 'FAMILY_EMERGENCY_STOP' },
    create: {
      key: 'FAMILY_EMERGENCY_STOP',
      value: 'false',
      description: '가족 자동화 전체 긴급 중지',
      updatedBy: createdUsers['admin@premiumshare.demo'],
    },
    update: { value: 'false' },
  })
  await prisma.appSetting.upsert({
    where: { key: 'family.global_emergency_stop' },
    create: {
      key: 'family.global_emergency_stop',
      value: 'false',
      description: '가족 자동화 전체 긴급 중지 (legacy alias)',
      updatedBy: createdUsers['admin@premiumshare.demo'],
    },
    update: { value: 'false' },
  })
  await prisma.appSetting.upsert({
    where: { key: 'family.authorized_browser_enabled' },
    create: {
      key: 'family.authorized_browser_enabled',
      value: 'false',
      description: 'AUTHORIZED_BROWSER — 실 UI 미검증 시 반드시 false',
      updatedBy: createdUsers['admin@premiumshare.demo'],
    },
    update: { value: 'false' },
  })
  console.log('  ✓ App settings')

  // ── FAMILY AUTOMATION (DEMO only) ─────────────────────────────────────────
  const groups = await prisma.subscriptionGroup.findMany({ take: 10 })
  for (const g of groups) {
    await prisma.familyAutomationSetting.upsert({
      where: { groupId: g.id },
      create: {
        groupId: g.id,
        mode: 'DEMO',
        autoInspect: true,
        autoCreateGroup: false,
        autoInvite: false,
        autoRemove: false,
        paused: false,
        authorizedEnabled: false,
        notes: '시드: DEMO 전용. AUTHORIZED_BROWSER 비활성.',
      },
      update: {
        mode: 'DEMO',
        authorizedEnabled: false,
      },
    })
    await prisma.familyOwnerConsent.create({
      data: {
        ownerAccountId: g.ownerAccountId,
        consentedBy: createdUsers['admin@premiumshare.demo'],
        scopeNote: '데모 운영 동의 — 가족 현황 조회/DEMO 자동화',
        evidenceNote:
          '플랫폼 운영 동의이며 Google/YouTube 공식 허가가 아닙니다. 시드 데이터.',
        isActive: true,
      },
    }).catch(() => {
      /* allow multiple consents; ignore rare failures */
    })
  }
  console.log('  ✓ Family automation DEMO settings (AUTHORIZED locked)')

  console.log('\n✅ Seed completed successfully!\n')
  console.log('📧 Demo accounts:')
  console.log('  admin@premiumshare.demo     / Admin1234!  [SUPER_ADMIN]')
  console.log('  operator@premiumshare.demo  / Oper1234!   [OPERATOR]')
  console.log('  support@premiumshare.demo   / Supp1234!   [SUPPORT]')
  console.log('  member1@premiumshare.demo   / Member1234! [MEMBER]')
  console.log('  member2@premiumshare.demo   / Member1234! [MEMBER]')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
