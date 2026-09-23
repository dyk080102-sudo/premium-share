import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = 20
    const skip = (page - 1) * limit

    const [imports, total] = await Promise.all([
      prisma.bankImport.findMany({
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bankImport.count(),
    ])

    return apiSuccess({ imports, total, page, limit })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('파일이 없습니다.', 400)
    if (!file.name.endsWith('.csv')) return apiError('CSV 파일만 허용됩니다.', 400)

    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    const dataLines = lines.slice(1) // skip header

    let rowCount = 0
    let errorCount = 0

    const bankImport = await prisma.bankImport.create({
      data: {
        filename: file.name,
        uploadedBy: user.id,
        rowCount: dataLines.length,
        status: 'PREVIEW',
      },
    })

    // Parse CSV rows (basic format: date, amount, depositorName, memo, externalId)
    for (const line of dataLines) {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 3) { errorCount++; continue }

      try {
        const [dateStr, amountStr, depositorName, memo, externalIdRaw] = cols
        const transactedAt = new Date(dateStr)
        const amountKrw = parseInt(amountStr.replace(/[^0-9-]/g, ''))
        const externalId = externalIdRaw || `${bankImport.id}-${rowCount}`

        if (isNaN(transactedAt.getTime()) || isNaN(amountKrw)) {
          errorCount++
          continue
        }

        await prisma.bankTransaction.upsert({
          where: { externalId },
          update: {},
          create: {
            importId: bankImport.id,
            externalId,
            transactedAt,
            amountKrw,
            depositorName: depositorName || 'UNKNOWN',
            memo: memo || null,
            matchStatus: 'UNMATCHED',
          },
        })
        rowCount++
      } catch {
        errorCount++
      }
    }

    await prisma.bankImport.update({
      where: { id: bankImport.id },
      data: { rowCount, errorCount },
    })

    return apiSuccess({ importId: bankImport.id, rowCount, errorCount }, 201)
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
