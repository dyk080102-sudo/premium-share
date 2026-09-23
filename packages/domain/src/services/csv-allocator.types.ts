// ===================== CSV ACCOUNT MODEL =====================

/** Represents a single row in the import/export CSV */
export interface CsvAccount {
  account_id: string
  email: string
  status: CsvAccountStatus
  family_group_id: string | null
  role: CsvRole | null
  joined_at: string | null   // ISO 8601 string
  updated_at: string | null  // ISO 8601 string
}

export type CsvAccountStatus =
  | 'PAID'
  | 'REFUNDED'
  | 'PENDING'
  | 'EXPIRED'
  | 'BLOCKED_POLICY'

export type CsvRole = 'MANAGER' | 'MEMBER'

// ===================== DERIVED IN-MEMORY GROUP =====================

/** In-memory group derived from CSV accounts */
export interface InMemoryGroup {
  groupId: string
  managerId: string | null
  managerEmail: string | null
  memberIds: string[]   // account_ids with role=MEMBER in this group
  allMemberIds: string[] // all account_ids (including manager) in this group
}

// ===================== RESULT TYPES =====================

export interface GroupVacancy {
  groupId: string
  currentMembers: number  // count of MEMBER-role accounts (not manager)
  vacancy: number         // 5 - currentMembers
  managerId: string | null
  managerEmail: string | null
}

export interface CsvProcessingResult {
  processedAt: string
  totalAccounts: number
  refundsProcessed: RefundResult[]
  allocationsPerformed: AllocationResult[]
  newGroupsCreated: NewGroupResult[]
  blockedAccounts: BlockedAccountResult[]
  errors: ProcessingError[]
  exportedCsv: string
}

export interface RefundResult {
  accountId: string
  email: string
  previousGroupId: string
  success: boolean
  error?: string
  wasManager: boolean
  managerReassignedTo?: string // account_id of the new manager if reassigned
  groupDissolved?: boolean
}

export interface AllocationResult {
  accountId: string
  email: string
  assignedGroupId: string
  isNewGroup: boolean
  success: boolean
  error?: string
}

export interface NewGroupResult {
  groupId: string
  managerId: string
  managerEmail: string
}

export interface BlockedAccountResult {
  accountId: string
  email: string
  reason: string
}

export interface ProcessingError {
  accountId: string
  email: string
  error: string
}
