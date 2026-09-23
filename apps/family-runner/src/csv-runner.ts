#!/usr/bin/env node
/**
 * CSV Runner — standalone CLI for the CsvAllocatorService
 *
 * Usage:
 *   npx tsx src/csv-runner.ts --input=./sample-accounts.csv [--output=./result-accounts.csv]
 *
 * Options:
 *   --input=<path>   Path to the input CSV file (required)
 *   --output=<path>  Path to write the processed CSV (optional; defaults to stdout if omitted)
 *   --dry-run        Parse and report only — do not write output file
 *   --verbose        Print per-account details in addition to the summary
 */

import * as fs from 'fs'
import * as path from 'path'
import { CsvAllocatorService } from '@premium-share/domain'
import type { CsvProcessingResult } from '@premium-share/domain'

// ===================== ARG PARSING =====================

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {}
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=')
      args[key] = rest.length > 0 ? rest.join('=') : true
    }
  }
  return args
}

// ===================== FORMATTING HELPERS =====================

function printSummary(result: CsvProcessingResult, verbose: boolean) {
  const sep = '─'.repeat(60)
  console.log(`\n${sep}`)
  console.log(`  CSV Allocator — 처리 완료`)
  console.log(`  처리 시각: ${result.processedAt}`)
  console.log(`${sep}`)
  console.log(`  총 계정 수            : ${result.totalAccounts}`)
  console.log(`  환불 처리             : ${result.refundsProcessed.length}건`)
  console.log(`  신규 배정             : ${result.allocationsPerformed.length}건`)
  console.log(`  신규 그룹 생성        : ${result.newGroupsCreated.length}건`)
  console.log(`  정책 차단             : ${result.blockedAccounts.length}건`)
  console.log(`  오류                  : ${result.errors.length}건`)
  console.log(sep)

  if (result.refundsProcessed.length > 0) {
    console.log('\n[환불 처리]')
    for (const r of result.refundsProcessed) {
      const mgr = r.wasManager
        ? r.groupDissolved
          ? ' (매니저→그룹 해체)'
          : ` (매니저→${r.managerReassignedTo} 재배정)`
        : ''
      const status = r.success ? '✓' : `✗ ${r.error}`
      console.log(`  ${status}  ${r.email}  [${r.previousGroupId}]${mgr}`)
    }
  }

  if (result.newGroupsCreated.length > 0) {
    console.log('\n[신규 그룹 생성]')
    for (const g of result.newGroupsCreated) {
      console.log(`  그룹 ${g.groupId} — 매니저: ${g.managerEmail} (${g.managerId})`)
    }
  }

  if (result.blockedAccounts.length > 0) {
    console.log('\n[정책 차단 (BLOCKED_POLICY)]')
    for (const b of result.blockedAccounts) {
      console.log(`  ${b.email} — ${b.reason}`)
    }
  }

  if (verbose && result.allocationsPerformed.length > 0) {
    console.log('\n[배정 결과]')
    for (const a of result.allocationsPerformed) {
      const tag = a.isNewGroup ? ' [신규 그룹]' : ''
      console.log(`  ${a.email} → ${a.assignedGroupId}${tag}`)
    }
  }

  if (result.errors.length > 0) {
    console.log('\n[오류]')
    for (const e of result.errors) {
      console.log(`  ${e.email} (${e.accountId}): ${e.error}`)
    }
  }

  console.log(`\n${sep}\n`)
}

// ===================== MAIN =====================

async function main() {
  const args = parseArgs(process.argv)

  const inputPath = args['input'] as string | undefined
  const outputPath = args['output'] as string | undefined
  const dryRun = args['dry-run'] === true
  const verbose = args['verbose'] === true

  if (!inputPath) {
    console.error('오류: --input=<파일 경로> 옵션이 필요합니다.')
    console.error('예시: npx tsx src/csv-runner.ts --input=./sample-accounts.csv')
    process.exit(1)
  }

  const resolvedInput = path.resolve(inputPath)
  if (!fs.existsSync(resolvedInput)) {
    console.error(`오류: 입력 파일을 찾을 수 없습니다: ${resolvedInput}`)
    process.exit(1)
  }

  console.log(`입력 파일 읽는 중: ${resolvedInput}`)
  const csvContent = fs.readFileSync(resolvedInput, 'utf-8')

  if (!csvContent.trim()) {
    console.error('오류: CSV 파일이 비어 있습니다.')
    process.exit(1)
  }

  const service = new CsvAllocatorService()

  console.log('처리 중...')
  const result = await service.parseAndProcess(csvContent)

  printSummary(result, verbose)

  if (dryRun) {
    console.log('[dry-run 모드] 출력 파일을 저장하지 않습니다.')
    return
  }

  if (outputPath) {
    const resolvedOutput = path.resolve(outputPath)
    fs.writeFileSync(resolvedOutput, result.exportedCsv, 'utf-8')
    console.log(`결과 CSV 저장됨: ${resolvedOutput}`)
  } else {
    console.log('\n[결과 CSV 출력]\n')
    console.log(result.exportedCsv)
  }
}

main().catch((err) => {
  console.error('예기치 않은 오류:', err instanceof Error ? err.message : err)
  process.exit(1)
})
