'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupVacancy {
  groupId: string
  managerId: string | null
  managerEmail: string | null
  currentMembers: number
  vacancy: number
}

interface RefundResult {
  accountId: string
  email: string
  previousGroupId: string
  success: boolean
  wasManager: boolean
  managerReassignedTo?: string
  groupDissolved?: boolean
  error?: string
}

interface AllocationResult {
  accountId: string
  email: string
  assignedGroupId: string
  isNewGroup: boolean
  success: boolean
  error?: string
}

interface NewGroupResult {
  groupId: string
  managerId: string
  managerEmail: string
}

interface BlockedAccountResult {
  accountId: string
  email: string
  reason: string
}

interface ProcessingError {
  accountId: string
  email: string
  error: string
}

interface CsvProcessingResult {
  processedAt: string
  totalAccounts: number
  refundsProcessed: RefundResult[]
  allocationsPerformed: AllocationResult[]
  newGroupsCreated: NewGroupResult[]
  blockedAccounts: BlockedAccountResult[]
  errors: ProcessingError[]
  exportedCsv: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'red' | 'orange' | 'yellow' | 'slate' }) {
  const colorMap = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    orange: 'bg-orange-100 text-orange-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[color]}`}>
      {children}
    </span>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ─── Section A: Upload Panel ──────────────────────────────────────────────────

interface UploadPanelProps {
  onCsvReady: (csv: string, file?: File) => void
  onClear: () => void
  onSubmit: () => void
  loading: boolean
  hasResult: boolean
  error: string | null
}

function UploadPanel({ onCsvReady, onClear, onSubmit, loading, hasResult, error }: UploadPanelProps) {
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [textValue, setTextValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) return
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      const csv = e.target?.result as string
      onCsvReady(csv, file)
    }
    reader.readAsText(file)
  }, [onCsvReady])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setTextValue(val)
    if (val.trim()) onCsvReady(val)
    else onClear()
  }, [onCsvReady, onClear])

  const handleClear = () => {
    setSelectedFile(null)
    setTextValue('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClear()
  }

  const canSubmit = mode === 'file' ? !!selectedFile : !!textValue.trim()

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">CSV 파일 업로드</h2>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'file' ? 'text' : 'file')
            handleClear()
          }}
          className="text-sm text-primary hover:underline"
        >
          {mode === 'file' ? '텍스트로 직접 입력' : '파일로 업로드'}
        </button>
      </div>

      {mode === 'file' ? (
        <div>
          {/* Drag-and-drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/30'
            }`}
          >
            <span className="text-3xl mb-2">📂</span>
            <p className="text-sm font-medium">CSV 파일을 드래그하거나 클릭하여 선택</p>
            <p className="text-xs text-muted-foreground mt-1">.csv 형식만 지원</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>

          {selectedFile && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span>📄</span>
              <span className="font-medium">{selectedFile.name}</span>
              <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>
      ) : (
        <textarea
          value={textValue}
          onChange={handleTextChange}
          placeholder="CSV 내용을 붙여넣으세요..."
          rows={8}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={onSubmit}
          disabled={!canSubmit || loading}
          className="gap-2"
        >
          {loading && <Spinner />}
          {loading ? '처리 중...' : '처리 시작'}
        </Button>
        <Button variant="outline" onClick={handleClear} disabled={loading}>
          초기화
        </Button>
      </div>
    </div>
  )
}

// ─── Section B: Group Vacancy Preview ────────────────────────────────────────

function VacancyPanel({ vacancies, loading }: { vacancies: GroupVacancy[] | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold text-base mb-4">처리 전 그룹 현황</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          그룹 현황 조회 중...
        </div>
      </div>
    )
  }

  if (vacancies === null) return null

  const list = Array.isArray(vacancies) ? vacancies : []

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="font-semibold text-base mb-4">처리 전 그룹 현황</h2>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">그룹 없음 (또는 아직 family_group_id가 없는 계정만 있습니다)</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">그룹 ID</th>
                <th className="text-left px-4 py-3 font-medium">매니저</th>
                <th className="text-right px-4 py-3 font-medium">현재 멤버</th>
                <th className="text-right px-4 py-3 font-medium">빈 자리</th>
                <th className="text-center px-4 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => {
                const vacancyColor =
                  v.vacancy === 0
                    ? 'bg-red-100 text-red-800'
                    : v.vacancy <= 2
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-green-100 text-green-800'
                const statusLabel =
                  v.vacancy === 0 ? '만석' : v.vacancy <= 2 ? '여유 적음' : '여유 있음'

                return (
                  <tr key={v.groupId} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.groupId}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.managerEmail ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{v.currentMembers} / 5</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${vacancyColor}`}>
                        {v.vacancy}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${vacancyColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Section C: Processing Results ───────────────────────────────────────────

function ResultsPanel({ result }: { result: CsvProcessingResult }) {
  const handleDownload = () => {
    const blob = new Blob([result.exportedCsv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `result-accounts-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalErrors = result.errors.length + result.blockedAccounts.length

  const summaryCards = [
    { label: '총 계정', value: result.totalAccounts, color: 'bg-blue-50 border-blue-200', icon: '👥' },
    { label: '환불 처리', value: `${result.refundsProcessed.length}건`, color: 'bg-purple-50 border-purple-200', icon: '💰' },
    { label: '신규 배정', value: `${result.allocationsPerformed.length}건`, color: 'bg-green-50 border-green-200', icon: '✅' },
    {
      label: '오류/차단',
      value: `${totalErrors}건`,
      color: totalErrors > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200',
      icon: totalErrors > 0 ? '❌' : '✅',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">
          처리 결과
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {new Date(result.processedAt).toLocaleString('ko-KR')}
          </span>
        </h2>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
          ⬇️ 처리된 CSV 다운로드
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
            <div className="text-2xl">{card.icon}</div>
            <div className="mt-2 text-2xl font-bold">{card.value}</div>
            <div className="text-sm text-muted-foreground">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Refunds Table */}
      {result.refundsProcessed.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-medium text-sm">환불 처리 내역 ({result.refundsProcessed.length}건)</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">이메일</th>
                  <th className="text-left px-4 py-3 font-medium">이전 그룹</th>
                  <th className="text-center px-4 py-3 font-medium">역할</th>
                  <th className="text-center px-4 py-3 font-medium">결과</th>
                </tr>
              </thead>
              <tbody>
                {result.refundsProcessed.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">{r.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.previousGroupId}</td>
                    <td className="px-4 py-3 text-center">
                      {r.wasManager ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge color="orange">매니저</Badge>
                          {r.groupDissolved && <Badge color="orange">그룹 해체</Badge>}
                          {r.managerReassignedTo && (
                            <span className="text-xs text-muted-foreground">→ 재배정</span>
                          )}
                        </div>
                      ) : (
                        <Badge color="slate">멤버</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.success ? (
                        <Badge color="green">성공</Badge>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Badge color="red">실패</Badge>
                          {r.error && <span className="text-xs text-red-600">{r.error}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allocations Table */}
      {result.allocationsPerformed.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-medium text-sm">배정 결과 ({result.allocationsPerformed.length}건)</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">이메일</th>
                  <th className="text-left px-4 py-3 font-medium">배정 그룹</th>
                  <th className="text-center px-4 py-3 font-medium">신규 그룹</th>
                  <th className="text-center px-4 py-3 font-medium">결과</th>
                </tr>
              </thead>
              <tbody>
                {result.allocationsPerformed.map((a, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">{a.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.assignedGroupId}</td>
                    <td className="px-4 py-3 text-center">
                      {a.isNewGroup ? <Badge color="yellow">신규</Badge> : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.success ? (
                        <Badge color="green">성공</Badge>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Badge color="red">실패</Badge>
                          {a.error && <span className="text-xs text-red-600">{a.error}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blocked Accounts */}
      {result.blockedAccounts.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-medium text-sm">정책 차단 ({result.blockedAccounts.length}건)</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">이메일</th>
                  <th className="text-left px-4 py-3 font-medium">사유</th>
                </tr>
              </thead>
              <tbody>
                {result.blockedAccounts.map((b, i) => (
                  <tr key={i} className="border-t bg-orange-50/50 hover:bg-orange-50">
                    <td className="px-4 py-3 font-medium">{b.email}</td>
                    <td className="px-4 py-3 text-orange-700">{b.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Groups Created */}
      {result.newGroupsCreated.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-medium text-sm">신규 그룹 생성 ({result.newGroupsCreated.length}개)</h3>
          <ul className="space-y-2">
            {result.newGroupsCreated.map((g, i) => (
              <li key={i} className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                <Badge color="yellow">신규</Badge>
                <span className="font-mono text-xs text-muted-foreground">{g.groupId}</span>
                <span className="text-muted-foreground">매니저:</span>
                <span>{g.managerEmail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <h3 className="font-medium text-sm text-red-800">오류 ({result.errors.length}건)</h3>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
              <li key={i} className="text-sm text-red-700">
                <span className="font-medium">{e.email}</span>
                {' — '}
                {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function CsvAllocatorClient() {
  const [csvContent, setCsvContent] = useState<string>('')
  const [currentFile, setCurrentFile] = useState<File | undefined>()
  const [vacancies, setVacancies] = useState<GroupVacancy[] | null>(null)
  const [vacancyLoading, setVacancyLoading] = useState(false)
  const [result, setResult] = useState<CsvProcessingResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch vacancy preview whenever CSV content changes
  useEffect(() => {
    if (!csvContent.trim()) {
      setVacancies(null)
      return
    }

    let cancelled = false
    setVacancyLoading(true)

    fetch('/api/admin/csv-allocator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent, preview: true }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? `그룹 현황 조회 실패: ${res.status}`)
        }
        if (!cancelled) {
          const groups = Array.isArray(json.data?.groups) ? json.data.groups : []
          setVacancies(groups)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err)
          setVacancies([])
          setError(err instanceof Error ? err.message : '그룹 현황 조회에 실패했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setVacancyLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [csvContent])

  const handleCsvReady = useCallback((csv: string, file?: File) => {
    setCsvContent(csv)
    setCurrentFile(file)
    setResult(null)
    setError(null)
  }, [])

  const handleClear = useCallback(() => {
    setCsvContent('')
    setCurrentFile(undefined)
    setVacancies(null)
    setResult(null)
    setError(null)
  }, [])

  const handleSubmit = async () => {
    if (!csvContent.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      let res: Response

      if (currentFile) {
        const formData = new FormData()
        formData.append('file', currentFile)
        res = await fetch('/api/admin/csv-allocator', {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await fetch('/api/admin/csv-allocator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent }),
        })
      }

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `서버 오류 (${res.status})`)
      }

      setResult(json.data ?? null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Section A: Upload */}
      <UploadPanel
        onCsvReady={handleCsvReady}
        onClear={handleClear}
        onSubmit={handleSubmit}
        loading={submitting}
        hasResult={!!result}
        error={error}
      />

      {/* Section B: Group Vacancy Preview */}
      {(vacancyLoading || vacancies !== null) && (
        <VacancyPanel vacancies={vacancies} loading={vacancyLoading} />
      )}

      {/* Section C: Processing Results */}
      {result && <ResultsPanel result={result} />}
    </div>
  )
}
