import { prisma } from '../../shared/database/prisma';
import { type SettingAuditEventDTO } from '@newtonite/shared';

export class AuditService {
  async getAuditHistory(query: { category?: string; page?: number; limit?: number }): Promise<{
    items: SettingAuditEventDTO[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where = query.category ? { category: query.category } : undefined;

    const [events, total] = await Promise.all([
      prisma.settingAuditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.settingAuditEvent.count({ where }),
    ]);

    return {
      items: events.map((e) => ({
        id: e.id,
        category: e.category,
        action: e.action,
        actorId: e.actorId,
        actorName: e.actor?.name || null,
        actorEmail: e.actor?.email || null,
        diff: e.diff as {
          before?: Record<string, unknown>;
          after?: Record<string, unknown>;
        } | null,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }
}

export const auditService = new AuditService();
