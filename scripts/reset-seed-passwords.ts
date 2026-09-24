import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const users: [string, string][] = [
  ['admin@premiumshare.demo', 'Admin1234!'],
  ['operator@premiumshare.demo', 'Oper1234!'],
  ['support@premiumshare.demo', 'Supp1234!'],
  ['member1@premiumshare.demo', 'Member1234!'],
  ['member2@premiumshare.demo', 'Member1234!'],
]

async function main() {
  for (const [email, pw] of users) {
    const passwordHash = await bcrypt.hash(pw, 12)
    const r = await prisma.user.update({
      where: { email },
      data: { passwordHash, loginAttempts: 0, lockedUntil: null },
    })
    console.log('updated', r.email)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
