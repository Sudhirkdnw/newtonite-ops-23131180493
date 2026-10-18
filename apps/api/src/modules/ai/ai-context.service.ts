import { prisma } from '../../shared/database/prisma';
import { type AuthenticatedUser } from '../../middleware/authenticate';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';
import { Priority, SlaStatus, WorkItemStatus, type ReferencedWorkItemDTO } from '@newtonite/shared';
import { calculateSlaStatus } from '../sla/sla-calculator';

export interface OperationalContextResult {
  systemPrompt: string;
  contextSummary: string;
  referencedItems: ReferencedWorkItemDTO[];
}

export class AiContextService {
  /**
   * Resolves authorized team IDs for the calling user.
   */
  resolveAccessibleTeamIds(user: AuthenticatedUser, targetTeamId?: string): string[] {
    if (user.systemRole === 'SYSTEM_ADMIN') {
      return targetTeamId ? [targetTeamId] : [];
    }

    const userTeamIds = Array.from(user.memberships.keys());
    if (targetTeamId) {
      if (!user.memberships.has(targetTeamId)) {
        throw new ForbiddenError(
          'Access denied: You do not have permission to view operational data for this team'
        );
      }
      return [targetTeamId];
    }

    return userTeamIds;
  }

  /**
   * Sanitizes and bounds untrusted user content to prevent prompt injection and credential leakage.
   */
  sanitizeUntrustedContent(rawText: string | null | undefined, maxChars = 2000): string {
    if (!rawText) return 'None';
    let text = rawText.slice(0, maxChars);

    // Redact sensitive patterns (JWTs, API keys, passwords, bearer tokens)
    text = text.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]');
    text = text.replace(
      /((?:password|secret|apikey|api_key)\s*[:=]\s*)['"]?[^\s'"]+['"]?/gi,
      '$1[REDACTED]'
    );
    text = text.replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '[REDACTED_JWT]');

    // Strip dangerous XML-like delimiter closing tags to prevent escape attacks
    text = text.replace(/<\/untrusted_content>/gi, '[stripped_delimiter]');

    return text.trim();
  }

  /**
   * Queries real overdue urgent items within user-permitted teams.
   */
  async getOverdueUrgentContext(
    user: AuthenticatedUser,
    teamId?: string
  ): Promise<OperationalContextResult> {
    const accessibleTeamIds = this.resolveAccessibleTeamIds(user, teamId);

    const whereClause = {
      status: { notIn: [WorkItemStatus.COMPLETED, WorkItemStatus.CANCELLED] },
      priority: { in: [Priority.CRITICAL, Priority.URGENT] },
      ...(accessibleTeamIds.length > 0 ? { teamId: { in: accessibleTeamIds } } : {}),
    };

    const items = await prisma.workItem.findMany({
      where: whereClause,
      include: { team: { select: { name: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 20,
    });

    const now = new Date();
    const overdueItems: Array<{
      item: (typeof items)[0];
      timeOverdueMs: number;
    }> = [];

    const referencedItems: ReferencedWorkItemDTO[] = [];

    for (const item of items) {
      const sla = calculateSlaStatus(
        {
          priority: item.priority as Priority,
          createdAt: item.createdAt,
          dueDate: item.dueDate,
          status: item.status as WorkItemStatus,
          lastEscalationStatus: item.lastEscalationStatus,
        },
        now
      );

      if (sla.status === SlaStatus.BREACHED) {
        overdueItems.push({ item, timeOverdueMs: Math.abs(sla.timeRemainingMs) });
        referencedItems.push({
          id: item.id,
          title: item.title,
          priority: item.priority as Priority,
          status: item.status as WorkItemStatus,
          teamId: item.teamId,
          teamName: item.team?.name,
          slaStatus: SlaStatus.BREACHED,
          timeRemainingFormatted: `${Math.round(Math.abs(sla.timeRemainingMs) / 60000)}m overdue`,
        });
      }
    }

    const contextLines = overdueItems.map((o) => {
      const minsOverdue = Math.round(o.timeOverdueMs / 60000);
      return `- [#${o.item.id.slice(0, 8)}] "${this.sanitizeUntrustedContent(o.item.title, 80)}" | Priority: ${o.item.priority} | Status: ${o.item.status} | Team: ${o.item.team?.name || 'Unknown'} | Overdue by: ${minsOverdue} minutes`;
    });

    const summaryText =
      overdueItems.length > 0
        ? `Found ${overdueItems.length} active urgent/critical items currently in breach of SLA:\n${contextLines.join('\n')}`
        : 'Zero active urgent items are currently overdue within authorized teams.';

    return {
      systemPrompt:
        'You are the Newtonite Operations Assistant specializing in operational triage. Analyze the verified overdue work items provided in the context. Emphasize confirmed facts and provide immediate action steps. Do not invent items.',
      contextSummary: summaryText,
      referencedItems,
    };
  }

  /**
   * Queries real items approaching SLA deadline within user-permitted teams.
   */
  async getApproachingSlaContext(
    user: AuthenticatedUser,
    teamId?: string
  ): Promise<OperationalContextResult> {
    const accessibleTeamIds = this.resolveAccessibleTeamIds(user, teamId);

    const whereClause = {
      status: { notIn: [WorkItemStatus.COMPLETED, WorkItemStatus.CANCELLED] },
      ...(accessibleTeamIds.length > 0 ? { teamId: { in: accessibleTeamIds } } : {}),
    };

    const items = await prisma.workItem.findMany({
      where: whereClause,
      include: { team: { select: { name: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 30,
    });

    const now = new Date();
    const approaching: Array<{
      item: (typeof items)[0];
      remainingMinutes: number;
    }> = [];

    const referencedItems: ReferencedWorkItemDTO[] = [];

    for (const item of items) {
      const sla = calculateSlaStatus(
        {
          priority: item.priority as Priority,
          createdAt: item.createdAt,
          dueDate: item.dueDate,
          status: item.status as WorkItemStatus,
          lastEscalationStatus: item.lastEscalationStatus,
        },
        now
      );

      if (sla.status === SlaStatus.AT_RISK) {
        const remainingMinutes = Math.max(0, Math.round(sla.timeRemainingMs / 60000));
        approaching.push({ item, remainingMinutes });
        referencedItems.push({
          id: item.id,
          title: item.title,
          priority: item.priority as Priority,
          status: item.status as WorkItemStatus,
          teamId: item.teamId,
          teamName: item.team?.name,
          slaStatus: SlaStatus.AT_RISK,
          timeRemainingFormatted: `${remainingMinutes}m remaining`,
        });
      }
    }

    const contextLines = approaching.map(
      (a) =>
        `- [#${a.item.id.slice(0, 8)}] "${this.sanitizeUntrustedContent(a.item.title, 80)}" | Priority: ${a.item.priority} | Status: ${a.item.status} | Team: ${a.item.team?.name || 'Unknown'} | Remaining: ${a.remainingMinutes} minutes`
    );

    const summaryText =
      approaching.length > 0
        ? `Found ${approaching.length} active items within warning threshold (AT_RISK):\n${contextLines.join('\n')}`
        : 'Zero active items are currently approaching SLA warning thresholds within authorized teams.';

    return {
      systemPrompt:
        'You are the Newtonite Operations Assistant specializing in proactive SLA protection. Advise operators on actions required to prevent near-deadline items from breaching.',
      contextSummary: summaryText,
      referencedItems,
    };
  }

  /**
   * Retrieves verified operational context for a single work item with strict team RBAC.
   */
  async getWorkItemContext(
    user: AuthenticatedUser,
    workItemId: string
  ): Promise<{
    item: {
      id: string;
      title: string;
      description: string | null;
      priority: Priority;
      status: WorkItemStatus;
      type: string;
      teamId: string;
      teamName?: string;
      assigneeName?: string | null;
      creatorName?: string | null;
      dueDate?: Date | null;
      createdAt: Date;
    };
    activities: Array<{ action: string; createdAt: Date; actorName?: string | null }>;
    comments: Array<{ body: string; createdAt: Date; authorName?: string | null }>;
    slaStatus: SlaStatus;
    timeRemainingMs: number;
    referencedItems: ReferencedWorkItemDTO[];
  }> {
    const item = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        activities: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { name: true } } },
        },
        comments: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { name: true } } },
        },
      },
    });

    if (!item) {
      throw new NotFoundError('Work item not found');
    }

    // Strict Team RBAC Check: Ensure operator belongs to the item's team
    const role = user.memberships.get(item.teamId);
    if (!role && user.systemRole !== 'SYSTEM_ADMIN') {
      // 404 to avoid leaking cross-team resource existence
      throw new NotFoundError('Work item not found');
    }

    const sla = calculateSlaStatus({
      priority: item.priority as Priority,
      createdAt: item.createdAt,
      dueDate: item.dueDate,
      status: item.status as WorkItemStatus,
      lastEscalationStatus: item.lastEscalationStatus,
    });

    const referencedItems: ReferencedWorkItemDTO[] = [
      {
        id: item.id,
        title: item.title,
        priority: item.priority as Priority,
        status: item.status as WorkItemStatus,
        teamId: item.teamId,
        teamName: item.team?.name,
        slaStatus: sla.status,
        timeRemainingFormatted: `${Math.round(sla.timeRemainingMs / 60000)}m`,
      },
    ];

    return {
      item: {
        id: item.id,
        title: item.title,
        description: item.description,
        priority: item.priority as Priority,
        status: item.status as WorkItemStatus,
        type: item.type,
        teamId: item.teamId,
        teamName: item.team?.name,
        assigneeName: item.assignee?.name || null,
        creatorName: item.creator?.name || null,
        dueDate: item.dueDate,
        createdAt: item.createdAt,
      },
      activities: item.activities.map((a) => ({
        action: a.action,
        createdAt: a.createdAt,
        actorName: a.actor?.name || null,
      })),
      comments: item.comments.map((c) => ({
        body: c.body,
        createdAt: c.createdAt,
        authorName: c.author?.name || null,
      })),
      slaStatus: sla.status,
      timeRemainingMs: sla.timeRemainingMs,
      referencedItems,
    };
  }

  /**
   * Queries workload summary across authorized teams.
   */
  async getWorkloadContext(
    user: AuthenticatedUser,
    teamId?: string
  ): Promise<OperationalContextResult> {
    const accessibleTeamIds = this.resolveAccessibleTeamIds(user, teamId);

    const whereClause = {
      status: { notIn: [WorkItemStatus.COMPLETED, WorkItemStatus.CANCELLED] },
      ...(accessibleTeamIds.length > 0 ? { teamId: { in: accessibleTeamIds } } : {}),
    };

    const [statusCounts, priorityCounts, totalActive] = await Promise.all([
      prisma.workItem.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true },
      }),
      prisma.workItem.groupBy({
        by: ['priority'],
        where: whereClause,
        _count: { id: true },
      }),
      prisma.workItem.count({ where: whereClause }),
    ]);

    const statusSummary = statusCounts.map((s) => `${s.status}: ${s._count.id}`).join(', ');
    const prioritySummary = priorityCounts.map((p) => `${p.priority}: ${p._count.id}`).join(', ');

    const summaryText = `Operational Workload Overview:\n- Total Active Work Items: ${totalActive}\n- Status Distribution: ${statusSummary || 'None'}\n- Priority Distribution: ${prioritySummary || 'None'}`;

    return {
      systemPrompt:
        'You are the Newtonite Operations Assistant analyzing enterprise operational capacity. Summarize workload trends using verified metrics without hallucinating counts.',
      contextSummary: summaryText,
      referencedItems: [],
    };
  }
}

export const aiContextService = new AiContextService();
