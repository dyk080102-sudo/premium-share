import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const jobs = await prisma.familyJob.findMany({
      orderBy: { requestedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        type: true,
        lockedBy: true,
        resultSummary: true,
        errorCode: true,
        ownerAccountId: true,
      },
    })
    console.log(JSON.stringify(jobs, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
