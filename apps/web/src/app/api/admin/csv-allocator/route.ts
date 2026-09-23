import { NextRequest, NextResponse } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import { apiError } from '@/lib/utils'
import { CsvAllocatorService } from '@premium-share/domain'

const csvAllocator = new CsvAllocatorService()

/** 10 MB hard cap — matches UPLOAD_MAX_SIZE_MB in .env */
const MAX_CSV_BYTES = 10 * 1024 * 1024

/** Accepted MIME types for CSV uploads */
const ALLOWED_CSV_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
])

/** Max chars accepted via the ?csv= GET query parameter (~500 KB URL-safe) */
const MAX_CSV_QUERY_CHARS = 500_000

/**
 * GET /api/admin/csv-allocator
 *
 * Returns current group vacancy derived from a provided CSV string in the query.
 * Query parameter: ?csv=<url-encoded CSV content>
 *
 * Returns: GroupVacancy[] sorted ascending by vacancy
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')

    const csvParam = request.nextUrl.searchParams.get('csv')
    if (!csvParam) {
      return NextResponse.json(
        {
          success: true,
          data: {
            groups: [],
            note: 'csv 쿼리 파라미터가 없습니다. ?csv=<CSV 내용>을 전달하세요.',
          },
        },
        { status: 200 },
      )
    }

    if (csvParam.length > MAX_CSV_QUERY_CHARS) {
      return apiError('csv 파라미터가 너무 큽니다 (최대 500KB).', 413)
    }

    const accounts = csvAllocator.parseCsvContent(decodeURIComponent(csvParam))
    const groups = await csvAllocator.getGroupsSortedByVacancy(accounts)

    return NextResponse.json({
      success: true,
      data: { groups, totalAccounts: accounts.length },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류', 500)
  }
}

/**
 * POST /api/admin/csv-allocator
 *
 * Accepts:
 *   - multipart/form-data with field `file` (CSV file upload), OR
 *   - application/json with body `{ csvContent: string }`
 *
 * Returns: CsvProcessingResult as JSON
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')

    const contentType = request.headers.get('content-type') ?? ''
    let csvContent: string

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file')

      if (!file || typeof file === 'string') {
        return apiError('multipart/form-data에 "file" 필드가 없습니다.', 400)
      }

      const csvFile = file as File

      // Validate MIME type / extension
      const fileExt = csvFile.name?.split('.').pop()?.toLowerCase()
      if (
        (csvFile.type && !ALLOWED_CSV_TYPES.has(csvFile.type)) &&
        fileExt !== 'csv'
      ) {
        return apiError('CSV 파일(.csv)만 업로드 가능합니다.', 415)
      }

      // Enforce file size limit
      if (csvFile.size > MAX_CSV_BYTES) {
        return apiError('파일 크기가 10MB를 초과합니다.', 413)
      }

      // file is a File/Blob
      csvContent = await csvFile.text()
    } else if (contentType.includes('application/json')) {
      const body = await request.json()
      if (typeof body.csvContent !== 'string' || !body.csvContent.trim()) {
        return apiError('JSON body에 "csvContent" 문자열 필드가 필요합니다.', 400)
      }

      // Enforce body size limit (character count ≈ byte count for ASCII CSV)
      if (body.csvContent.length > MAX_CSV_BYTES) {
        return apiError('CSV 내용이 10MB를 초과합니다.', 413)
      }

      csvContent = body.csvContent
    } else {
      return apiError(
        'Content-Type은 multipart/form-data 또는 application/json 이어야 합니다.',
        415,
      )
    }

    if (!csvContent.trim()) {
      return apiError('CSV 내용이 비어 있습니다.', 400)
    }

    const result = await csvAllocator.parseAndProcess(csvContent)

    return NextResponse.json({ success: true, data: result }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('CSV 처리 중 오류가 발생했습니다.', 500)
  }
}
