/**
 * Unified Server — 단일 호스트 통합 서버
 * ─────────────────────────────────────────────────────────────────────────────
 * 세 개의 앱(web, worker, family-runner)을 하나의 Node.js 프로세스에서 실행합니다.
 *
 * 라우팅:
 *   /            → 일반 사용자 (상품 목록, 주문, 구독, 마이페이지)
 *   /auth/*      → 로그인·회원가입·비밀번호 재설정
 *   /admin/*     → 관리자 전용 (미들웨어로 세션 검증)
 *   /mock-admin/ → 패밀리 DEMO 모의 화면 (static HTML)
 *   /api/*       → REST API (사용자 + 관리자)
 *
 * 백그라운드 프로세스:
 *   - Worker : node-cron 기반 스케줄 작업 (만료 처리, 이메일 발신함 등)
 *   - FamilyRunner : 패밀리 그룹 자동화 폴링 루프
 *
 * 실행:
 *   개발: npm run dev:unified   (tsx watch server.ts)
 *   운영: npm run start:unified (node dist/server.js)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import http from 'http'
import { parse } from 'url'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import next from 'next'
import { PrismaClient } from '@prisma/client'

import { startWorkerJobs } from './src/server/worker-jobs'
import { startFamilyRunner } from './src/server/family-runner'

// ESM 환경에서도 __dirname 사용 가능하도록 처리
// tsx 로 실행 시에는 __dirname 이 이미 정의되어 있으나, ESM 빌드 대비 보완
const _dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

const port = parseInt(process.env.PORT ?? '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME ?? 'localhost'

// 공유 Prisma 인스턴스 (Next.js API Route 에서는 별도 인스턴스 사용)
const prisma = new PrismaClient()

// mock-admin HTML 경로 (public/mock-admin/index.html)
const mockAdminHtmlPath = path.join(_dirname, 'public', 'mock-admin', 'index.html')

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

async function main() {
  console.log('[unified] Preparing Next.js...')
  await app.prepare()

  // ── 백그라운드 작업 시작 ─────────────────────────────────────────────────
  startWorkerJobs(prisma)
  startFamilyRunner(prisma)

  // ── HTTP 서버 ────────────────────────────────────────────────────────────
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url ?? '/', true)
      const { pathname } = parsedUrl

      // /mock-admin/ 또는 /mock-admin → static HTML 응답
      if (pathname === '/mock-admin' || pathname === '/mock-admin/' || pathname === '/mock-admin/index.html') {
        if (fs.existsSync(mockAdminHtmlPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          fs.createReadStream(mockAdminHtmlPath).pipe(res)
          return
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('mock-admin HTML not found. Run: npm run copy:mock-admin')
          return
        }
      }

      // 나머지는 Next.js 핸들러에 위임
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('[unified] request error:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })

  server.listen(port, () => {
    const base = `http://${hostname}:${port}`
    console.log('')
    console.log('┌─────────────────────────────────────────────┐')
    console.log('│  🚀  Unified PremiumShare Server             │')
    console.log('├─────────────────────────────────────────────┤')
    console.log(`│  Base URL  : ${base.padEnd(32)}│`)
    console.log(`│  사용자     : ${base}/                        │`)
    console.log(`│  관리자     : ${base}/admin                   │`)
    console.log(`│  Mock Admin : ${base}/mock-admin/             │`)
    console.log('├─────────────────────────────────────────────┤')
    console.log('│  Worker Jobs     ✅ Running                  │')
    console.log('│  Family Runner   ✅ Running                  │')
    console.log('└─────────────────────────────────────────────┘')
    console.log('')
  })

  // ── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[unified] ${signal} received. Shutting down...`)
    server.close(async () => {
      await prisma.$disconnect()
      console.log('[unified] Shutdown complete.')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((e) => {
  console.error('[unified] Fatal error:', e)
  process.exit(1)
})
