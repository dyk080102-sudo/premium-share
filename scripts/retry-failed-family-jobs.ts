import { PrismaClient, FamilyJobStatus } from '@prisma/client'
import { FamilyJobService } from '@premium-share/domain'

async function main() {
  const prisma = new PrismaClient()
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    })
    const failed = await prisma.familyJob.findMany({
      where: { status: FamilyJobStatus.FAILED },
      orderBy: { requestedAt: 'desc' },
      take: 5,
    })
    const jobs = new FamilyJobService(prisma)
    for (const j of failed) {
      const u = await jobs.retry(j.id, admin?.id)
      console.log('retried', u.id, u.status, u.retryCount)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
