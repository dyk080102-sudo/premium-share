import { PrismaClient, BusinessSource } from '@prisma/client'

export class AuditService {
  constructor(private db: PrismaClient) {}

  async log(params: {
    actorId?: string | null
    actorRole?: string | null
    targetType: string
    targetId: string
    action: string
    before?: unknown
    after?: unknown
    reason?: string
    source?: BusinessSource
    requestId?: string
    ipAddress?: string
  }) {
    // actorId는 User FK — 워커/시스템 문자열을 넣으면 실패하므로 유효 User만 연결
    let actorId: string | null = params.actorId ?? null
    if (actorId) {
      const user = await this.db.user.findUnique({
        where: { id: actorId },
        select: { id: true },
      })
      if (!user) {
        actorId = null
      }
    }

    return this.db.auditLog.create({
      data: {
        actorId,
        actorRole: params.actorRole ?? null,
        targetType: params.targetType,
        targetId: params.targetId,
        action: params.action,
        beforeJson: params.before ? (params.before as object) : undefined,
        afterJson: params.after ? (params.after as object) : undefined,
        reason: params.reason,
        source: params.source ?? BusinessSource.DEMO,
        requestId: params.requestId,
        ipAddress: params.ipAddress,
      },
    })
  }
}
