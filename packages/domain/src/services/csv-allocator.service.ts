/**
 * CsvAllocatorService
 *
 * Pure in-memory CSV-based family group allocation system.
 * Does NOT touch the Prisma database — operates entirely on CSV data.
 *
 * Business rules:
 *  - Max 6 members per group (1 MANAGER + 5 MEMBERs)
 *  - Vacancy = 5 − current MEMBER count
 *  - Groups sorted ascending by vacancy when filling (least-vacant first = fill existing groups)
 *  - REFUNDED accounts: removed from group immediately; if they were MANAGER, reassign to
 *    another active PAID MEMBER, or dissolve the group if none remain.
 *  - PAID + unassigned accounts: allocated to least-vacant group first; new group created if all full.
 *  - 12-month re-join limit: a PAID account whose joined_at is within the last 12 months AND
 *    family_group_id is null is considered to have left a group recently — set BLOCKED_POLICY.
 */

import type {
  CsvAccount,
  CsvAccountStatus,
  CsvRole,
  GroupVacancy,
  CsvProcessingResult,
  RefundResult,
  AllocationResult,
  NewGroupResult,
  BlockedAccountResult,
  ProcessingError,
  InMemoryGroup,
} from './csv-allocator.types'

// ===================== CONSTANTS =====================

const MAX_MEMBERS_PER_GROUP = 5 // Excludes manager
const REJOIN_BLOCK_MONTHS = 12

// ===================== CSV HELPERS =====================

function parseCsvRow(row: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function parseCsv(content: string): string[][] {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')

  return lines.map(parseCsvRow)
}

function escapeCsvField(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  // Prevent CSV/spreadsheet formula injection (Excel, Google Sheets).
  // Any cell beginning with =, +, -, @, |, % or a tab character is treated
  // as a formula trigger — prefix with a single-quote so it is rendered as
  // plain text instead.
  const safe = /^[=+\-@|%\t]/.test(str) ? `'${str}` : str
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

// ===================== DATE HELPERS =====================

function isWithinMonths(dateIso: string | null, months: number): boolean {
  if (!dateIso) return false
  try {
    const date = new Date(dateIso)
    if (isNaN(date.getTime())) return false
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return date > cutoff
  } catch {
    return false
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

// ===================== UNIQUE ID GENERATOR =====================

let _idCounter = 0
function generateGroupId(): string {
  _idCounter++
  return `grp-new-${Date.now()}-${_idCounter}`
}

// ===================== MAIN SERVICE =====================

export class CsvAllocatorService {
  /**
   * Parse CSV content and run the full processing pipeline:
   *   1. Parse rows into CsvAccount[]
   *   2. Build in-memory group state
   *   3. Process REFUNDED accounts (remove from groups, handle manager reassignment)
   *   4. Check 12-month re-join policy on PAID unassigned accounts
   *   5. Allocate PAID+unassigned accounts to groups
   *   6. Export final state as CSV
   */
  async parseAndProcess(csvContent: string): Promise<CsvProcessingResult> {
    const processedAt = nowIso()

    // --- Step 1: Parse CSV ---
    const accounts = this.parseCsvContent(csvContent)
    const errors: ProcessingError[] = []

    // --- Step 2: Process refunds ---
    const refundsProcessed: RefundResult[] = []
    const { updatedAccounts: afterRefund, results: refundResults } =
      this._processRefunds(accounts)
    refundsProcessed.push(...refundResults)

    // --- Step 3: Check 12-month policy + allocate PAID unassigned ---
    const blockedAccounts: BlockedAccountResult[] = []
    const allocationsPerformed: AllocationResult[] = []
    const newGroupsCreated: NewGroupResult[] = []

    const { updatedAccounts: finalAccounts } = this._allocatePaidAccounts(
      afterRefund,
      blockedAccounts,
      allocationsPerformed,
      newGroupsCreated,
      errors,
    )

    // --- Step 4: Export CSV ---
    const exportedCsv = this._accountsToCsv(finalAccounts)

    return {
      processedAt,
      totalAccounts: accounts.length,
      refundsProcessed,
      allocationsPerformed,
      newGroupsCreated,
      blockedAccounts,
      errors,
      exportedCsv,
    }
  }

  /**
   * Parse raw CSV string into CsvAccount[].
   * Expected header: account_id,email,status,family_group_id,role,joined_at,updated_at
   */
  parseCsvContent(csvContent: string): CsvAccount[] {
    // Strip UTF-8 BOM (common in Excel-exported CSV)
    const normalized = csvContent.replace(/^\uFEFF/, '')
    const rows = parseCsv(normalized)
    if (rows.length === 0) return []

    const header = rows[0].map((h) => h.replace(/^\uFEFF/, '').toLowerCase().trim())
    const col = (name: string) => header.indexOf(name)

    const idxAccountId = col('account_id')
    const idxEmail = col('email')
    const idxStatus = col('status')
    const idxGroupId = col('family_group_id')
    const idxRole = col('role')
    const idxJoinedAt = col('joined_at')
    const idxUpdatedAt = col('updated_at')

    if (idxAccountId < 0 || idxEmail < 0) {
      throw new Error(
        'CSV 헤더에 account_id, email 컬럼이 필요합니다. (예: account_id,email,status,family_group_id,role,joined_at,updated_at)',
      )
    }

    const accounts: CsvAccount[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const get = (idx: number): string => (idx >= 0 ? (row[idx] ?? '').trim() : '')
      const getOrNull = (idx: number): string | null => {
        const v = get(idx)
        return v === '' ? null : v
      }

      const account_id = get(idxAccountId)
      const email = get(idxEmail)
      if (!account_id || !email) continue

      const rawStatus = get(idxStatus).toUpperCase()
      const status = this._coerceStatus(rawStatus)

      const rawRole = get(idxRole).toUpperCase()
      const role = this._coerceRole(rawRole)

      accounts.push({
        account_id,
        email,
        status,
        family_group_id: getOrNull(idxGroupId),
        role,
        joined_at: getOrNull(idxJoinedAt),
        updated_at: getOrNull(idxUpdatedAt),
      })
    }

    return accounts
  }

  // ===================== GROUP VACANCY =====================

  /**
   * Derive group vacancy from an array of accounts.
   * Sort ascending by vacancy (1 → 5) — fill least-vacant first.
   */
  async getGroupsSortedByVacancy(accounts?: CsvAccount[]): Promise<GroupVacancy[]> {
    // When called without args, return empty (requires external accounts)
    if (!accounts || accounts.length === 0) return []
    return this._buildGroupVacancy(accounts)
  }

  private _buildGroupVacancy(accounts: CsvAccount[]): GroupVacancy[] {
    const groups = this._buildGroupMap(accounts)
    const vacancies: GroupVacancy[] = []

    for (const [groupId, grp] of Array.from(groups.entries())) {
      const memberCount = grp.memberIds.length
      const vacancy = Math.max(0, MAX_MEMBERS_PER_GROUP - memberCount)

      // Find manager email
      const managerAccount = accounts.find((a) => a.account_id === grp.managerId)

      vacancies.push({
        groupId,
        currentMembers: memberCount,
        vacancy,
        managerId: grp.managerId,
        managerEmail: managerAccount?.email ?? null,
      })
    }

    // Sort ascending by vacancy (least vacant = smallest vacancy first)
    vacancies.sort((a, b) => a.vacancy - b.vacancy)
    return vacancies
  }

  /** Build a map of groupId → InMemoryGroup from accounts */
  private _buildGroupMap(accounts: CsvAccount[]): Map<string, InMemoryGroup> {
    const groups = new Map<string, InMemoryGroup>()

    for (const acc of accounts) {
      if (!acc.family_group_id) continue

      const gid = acc.family_group_id
      if (!groups.has(gid)) {
        groups.set(gid, {
          groupId: gid,
          managerId: null,
          managerEmail: null,
          memberIds: [],
          allMemberIds: [],
        })
      }

      const grp = groups.get(gid)!
      grp.allMemberIds.push(acc.account_id)

      if (acc.role === 'MANAGER') {
        grp.managerId = acc.account_id
        grp.managerEmail = acc.email
      } else if (acc.role === 'MEMBER') {
        grp.memberIds.push(acc.account_id)
      }
    }

    return groups
  }

  // ===================== REFUND PROCESSING =====================

  /**
   * Remove REFUNDED accounts from their groups.
   * - If the refunded account was a MANAGER, reassign to another active PAID MEMBER.
   * - If no active PAID members remain in the group, dissolve the group (clear all family_group_id).
   */
  async processRefunds(accounts: CsvAccount[]): Promise<RefundResult[]> {
    return this._processRefunds(accounts).results
  }

  private _processRefunds(accounts: CsvAccount[]): {
    updatedAccounts: CsvAccount[]
    results: RefundResult[]
  } {
    // Work on a mutable copy (shallow-clone each account)
    const state = accounts.map((a) => ({ ...a }))
    const results: RefundResult[] = []

    const refundedAccounts = state.filter(
      (a) => a.status === 'REFUNDED' && a.family_group_id !== null,
    )

    for (const acc of refundedAccounts) {
      const previousGroupId = acc.family_group_id!
      const wasManager = acc.role === 'MANAGER'
      const result: RefundResult = {
        accountId: acc.account_id,
        email: acc.email,
        previousGroupId,
        success: false,
        wasManager,
      }

      try {
        if (wasManager) {
          // Find another PAID active member in the same group to become manager
          const eligibleNewManager = state.find(
            (a) =>
              a.account_id !== acc.account_id &&
              a.family_group_id === previousGroupId &&
              a.role === 'MEMBER' &&
              a.status === 'PAID',
          )

          if (eligibleNewManager) {
            // Reassign manager role
            eligibleNewManager.role = 'MANAGER'
            eligibleNewManager.updated_at = nowIso()
            result.managerReassignedTo = eligibleNewManager.account_id
          } else {
            // No eligible member — dissolve group
            const groupMembers = state.filter(
              (a) => a.family_group_id === previousGroupId,
            )
            for (const m of groupMembers) {
              m.family_group_id = null
              m.role = null
              m.updated_at = nowIso()
            }
            result.groupDissolved = true
          }
        }

        // Remove refunded account from group
        acc.family_group_id = null
        acc.role = null
        acc.updated_at = nowIso()

        result.success = true
      } catch (err) {
        result.success = false
        result.error = err instanceof Error ? err.message : String(err)
      }

      results.push(result)
    }

    return { updatedAccounts: state, results }
  }

  // ===================== ALLOCATION =====================

  /**
   * Allocate PAID unassigned accounts to existing groups (least-vacant first),
   * creating new groups as needed.
   * Accounts that violate the 12-month re-join policy are blocked instead.
   */
  async allocatePaidAccounts(accounts: CsvAccount[]): Promise<AllocationResult[]> {
    const blockedAccounts: BlockedAccountResult[] = []
    const allocationsPerformed: AllocationResult[] = []
    const newGroupsCreated: NewGroupResult[] = []
    const errors: ProcessingError[] = []
    this._allocatePaidAccounts(
      accounts,
      blockedAccounts,
      allocationsPerformed,
      newGroupsCreated,
      errors,
    )
    return allocationsPerformed
  }

  private _allocatePaidAccounts(
    accounts: CsvAccount[],
    blockedAccounts: BlockedAccountResult[],
    allocationsPerformed: AllocationResult[],
    newGroupsCreated: NewGroupResult[],
    errors: ProcessingError[],
  ): { updatedAccounts: CsvAccount[] } {
    const state = accounts.map((a) => ({ ...a }))

    // Identify PAID accounts that are unassigned
    const unassigned = state.filter(
      (a) => a.status === 'PAID' && a.family_group_id === null,
    )

    for (const acc of unassigned) {
      try {
        // --- 12-month re-join policy check ---
        // If the account has a joined_at date within the last 12 months and is now unassigned,
        // it means they recently left a group → policy violation.
        if (acc.joined_at && isWithinMonths(acc.joined_at, REJOIN_BLOCK_MONTHS)) {
          acc.status = 'BLOCKED_POLICY'
          acc.updated_at = nowIso()
          blockedAccounts.push({
            accountId: acc.account_id,
            email: acc.email,
            reason: `12개월 이내 재가입 제한 (최근 joined_at: ${acc.joined_at})`,
          })
          continue
        }

        // --- Find least-vacant group with space ---
        const vacancies = this._buildGroupVacancy(state)
        const target = vacancies.find((v) => v.vacancy > 0)

        let assignedGroupId: string
        let isNewGroup = false

        if (target) {
          assignedGroupId = target.groupId
        } else {
          // All groups are full — create a new group with this account as MANAGER
          assignedGroupId = generateGroupId()
          isNewGroup = true

          acc.role = 'MANAGER'
          acc.family_group_id = assignedGroupId
          acc.joined_at = acc.joined_at ?? nowIso()
          acc.updated_at = nowIso()

          newGroupsCreated.push({
            groupId: assignedGroupId,
            managerId: acc.account_id,
            managerEmail: acc.email,
          })

          allocationsPerformed.push({
            accountId: acc.account_id,
            email: acc.email,
            assignedGroupId,
            isNewGroup: true,
            success: true,
          })
          continue
        }

        // Assign to the target group as MEMBER
        acc.role = 'MEMBER'
        acc.family_group_id = assignedGroupId
        acc.joined_at = acc.joined_at ?? nowIso()
        acc.updated_at = nowIso()

        allocationsPerformed.push({
          accountId: acc.account_id,
          email: acc.email,
          assignedGroupId,
          isNewGroup,
          success: true,
        })
      } catch (err) {
        errors.push({
          accountId: acc.account_id,
          email: acc.email,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return { updatedAccounts: state }
  }

  // ===================== CSV EXPORT =====================

  /**
   * Export the provided accounts as a CSV string.
   * When called without arguments, returns only the header row.
   */
  async exportToCsv(accounts?: CsvAccount[]): Promise<string> {
    return this._accountsToCsv(accounts ?? [])
  }

  private _accountsToCsv(accounts: CsvAccount[]): string {
    const header = 'account_id,email,status,family_group_id,role,joined_at,updated_at'
    const rows = accounts.map((a) =>
      [
        escapeCsvField(a.account_id),
        escapeCsvField(a.email),
        escapeCsvField(a.status),
        escapeCsvField(a.family_group_id),
        escapeCsvField(a.role),
        escapeCsvField(a.joined_at),
        escapeCsvField(a.updated_at),
      ].join(','),
    )
    return [header, ...rows].join('\n')
  }

  // ===================== COERCE HELPERS =====================

  private _coerceStatus(raw: string): CsvAccountStatus {
    const allowed: CsvAccountStatus[] = [
      'PAID',
      'REFUNDED',
      'PENDING',
      'EXPIRED',
      'BLOCKED_POLICY',
    ]
    return (allowed.includes(raw as CsvAccountStatus) ? raw : 'PENDING') as CsvAccountStatus
  }

  private _coerceRole(raw: string): CsvRole | null {
    if (raw === 'MANAGER') return 'MANAGER'
    if (raw === 'MEMBER') return 'MEMBER'
    return null
  }
}
