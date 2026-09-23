/**
 * Same helper for Vercel Root Directory = apps/web
 * (Vercel only looks for vercel.json inside the Root Directory.)
 */
import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

function findSchema() {
  const candidates = [
    join(process.cwd(), 'packages/domain/prisma/schema.prisma'),
    join(process.cwd(), '../../packages/domain/prisma/schema.prisma'),
    join(__dirname, '../../../packages/domain/prisma/schema.prisma'),
  ]

  for (const p of candidates) {
    const abs = resolve(p)
    if (existsSync(abs)) return abs
  }

  throw new Error(
    `Prisma schema not found. cwd=${process.cwd()} tried:\n` +
      candidates.map((c) => ` - ${resolve(c)}`).join('\n'),
  )
}

const schema = findSchema()
const root = resolve(dirname(schema), '../../..')
const webDir = join(root, 'apps/web')

console.log(`[vercel-build] root=${root}`)
console.log(`[vercel-build] schema=${schema}`)

function run(cmd, cwd) {
  console.log(`[vercel-build] $ ${cmd}  (cwd=${cwd})`)
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env })
}

run(`npx prisma generate --schema="${schema}"`, root)
run('npx next build', webDir)
