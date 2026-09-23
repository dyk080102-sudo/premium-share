import { PrismaClient, BusinessSource, Prisma } from '@prisma/client'

/**
 * Sheets 연동용 Outbox 이벤트.
 * 비밀번호·세션·쿠키·토큰은 절대 포함하지 않는다.
 */
const FORBIDDEN_KEYS = [
  'password',
  'passwd',
  'secret',
  'cookie',
  'cookies',
  'session',
  'token',
  'refreshToken',
  'accessToken',
  'credential',
  'credentials',
]

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    const lower = k.toLowerCase()
    if (FORBIDDEN_KEYS.some((f) => lower.includes(f.toLowerCase()))) {
      continue
    }
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = sanitizePayload(v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

export class FamilySheetsService {
  constructor(private db: PrismaClient) {}

  async emitEvent(params: {
    eventType: string
    groupId: string
    payload: Record<string, unknown>
    actorId?: string
    recipientContact?: string
  }) {
    const safe = sanitizePayload({
      ...params.payload,
      groupId: params.groupId,
      eventType: params.eventType,
      emittedAt: new Date().toISOString(),
    })

    // recipientUserId는 User FK — 워커 ID를 넣지 않음
    let recipientUserId: string | null = params.actorId ?? null
    if (recipientUserId) {
      const user = await this.db.user.findUnique({
        where: { id: recipientUserId },
        select: { id: true },
      })
      if (!user) recipientUserId = null
    }

    return this.db.outboxMessage.create({
      data: {
        type: `FAMILY_SHEETS:${params.eventType}`,
        recipientUserId,
        recipientContact: params.recipientContact ?? 'sheets://family-automation',
        subject: `Family automation: ${params.eventType}`,
        content: JSON.stringify(safe),
        templateKey: 'family_sheets_event',
        variables: safe as Prisma.InputJsonValue,
        status: 'PENDING',
        source: BusinessSource.DEMO,
      },
    })
  }
}
