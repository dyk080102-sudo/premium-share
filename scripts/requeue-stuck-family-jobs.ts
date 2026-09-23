import { PrismaClient, FamilyJobStatus } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const stuck = await prisma.familyJob.updateMany({
      where: {
        status: {
          in: [FamilyJobStatus.CLAIMED, FamilyJobStatus.IN_PROGRESS],
        },
      },
      data: {
        status: FamilyJobStatus.QUEUED,
        lockedBy: null,
        lockedAt: null,
        errorCode: null,
        resultSummary: 'requeued after runner audit FK fix',
      },
    })
    console.log('requeued', stuck.count)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
