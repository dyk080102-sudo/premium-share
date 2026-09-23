import { PrismaClient, FamilyJobType, FamilyAutomationMode } from '@prisma/client'
import { FamilyJobService, FamilyGateService } from '@premium-share/domain'

async function main() {
  const prisma = new PrismaClient()
  try {
    const group = await prisma.subscriptionGroup.findFirst({
      where: { status: 'ACTIVE' },
      include: { familyAutomationSetting: true },
    })
    if (!group) throw new Error('no active group')

    const gate = new FamilyGateService(prisma)
    const g = await gate.assertCanRun({
      groupId: group.id,
      jobType: FamilyJobType.INSPECT,
    })
    console.log('gate', JSON.stringify(g))

    const admin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    })

    const jobs = new FamilyJobService(prisma)
    const job = await jobs.enqueue({
      type: FamilyJobType.INSPECT,
      groupId: group.id,
      ownerAccountId: group.ownerAccountId,
      mode: FamilyAutomationMode.DEMO,
      idempotencyKey: `demo-inspect-${Date.now()}`,
      actorId: admin?.id,
    })
    console.log('enqueued', job.id, job.status, job.errorCode ?? '', job.resultSummary ?? '')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
