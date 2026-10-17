import {
  ActivityAction,
  Priority,
  SlaOverviewDTO,
  SlaStatus,
  WorkItemStatus,
  WorkItemSummaryDTO,
  WorkItemType,
} from '@newtonite/shared';
import { prisma } from '../../shared/database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logger/logger';
import type { AuthenticatedUser } from '../../middleware/authenticate';
import { calculateSlaStatus } from './sla-calculator';

export interface ScanAndEscalateOptions {
  now?: Date;
  teamId?: string;
  batchSize?: number;
}

export interface ScanResult {
  scanned: number;
  escalated: number;
  unchanged: number;
}

export class SlaService {
  /**
   * Deterministically scans active work items, calculates SLA deadlines,
   * and transactionally escalates items reaching AT_RISK or BREACHED thresholds.
   *
   * Idempotency guarantee:
   * Uses an atomic conditional database update (WHERE id = :id AND lastEscalationStatus = :oldStatus)
   * within a Prisma transaction. Repeated executions produce zero duplicate ActivityEvents
   * or OutboxJobs.
   */
  async scanAndEscalate(options: ScanAndEscalateOptions = {}): Promise<ScanResult> {
    const now = options.now ?? new Date();
    const batchSize = Math.min(options.batchSize ?? 50, 200);

    // Bounded indexed query for active items
    const candidates = await prisma.workItem.findMany({
      where: {
        status: { notIn: [WorkItemStatus.COMPLETED, WorkItemStatus.CANCELLED] },
        ...(options.teamId ? { teamId: options.teamId } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: batchSize,
    });

    let escalatedCount = 0;
    let unchangedCount = 0;

    for (const candidate of candidates) {
      const sla = calculateSlaStatus(
        {
          priority: candidate.priority as Priority,
          createdAt: candidate.createdAt,
          dueDate: candidate.dueDate,
          status: candidate.status as WorkItemStatus,
          lastEscalationStatus: candidate.lastEscalationStatus,
        },
        now
      );

      // Determine target escalation level based on computed SLA status
      let targetEscalation: string = 'NONE';
      if (sla.status === SlaStatus.BREACHED) {
        targetEscalation = 'BREACHED';
      } else if (sla.status === SlaStatus.AT_RISK) {
        targetEscalation = 'AT_RISK';
      }

      // If item hasn't changed escalation level or is healthy, no-op
      if (targetEscalation === 'NONE' || candidate.lastEscalationStatus === targetEscalation) {
        unchangedCount++;
        continue;
      }

      // Transactional, atomic conditional escalation
      try {
        const didEscalate = await prisma.$transaction(async (tx) => {
          // 1. Atomic conditional update to guard against concurrent worker races
          const updateResult = await tx.workItem.updateMany({
            where: {
              id: candidate.id,
              lastEscalationStatus: candidate.lastEscalationStatus,
              status: { notIn: [WorkItemStatus.COMPLETED, WorkItemStatus.CANCELLED] },
            },
            data: {
              lastEscalationStatus: targetEscalation,
            },
          });

          if (updateResult.count === 0) {
            // Concurrently claimed/escalated or status transitioned to closed
            return false;
          }

          // 2. Append immutable audit activity event
          await tx.activityEvent.create({
            data: {
              workItemId: candidate.id,
              action: ActivityAction.ESCALATED,
              previousState: { lastEscalationStatus: candidate.lastEscalationStatus },
              newState: {
                lastEscalationStatus: targetEscalation,
                slaStatus: sla.status,
              },
              metadata: {
                targetDeadline: sla.targetDeadline,
                timeRemainingMs: sla.timeRemainingMs,
                priority: candidate.priority,
                reason:
                  targetEscalation === 'BREACHED'
                    ? 'SLA commitment exceeded'
                    : 'Approaching SLA deadline threshold',
              },
            },
          });

          // 3. Atomically enqueue outbox job for resilient async notification
          await tx.outboxJob.create({
            data: {
              aggregateType: 'WorkItem',
              aggregateId: candidate.id,
              eventType: 'WORK_ITEM_ESCALATED',
              payload: {
                workItemId: candidate.id,
                teamId: candidate.teamId,
                title: candidate.title,
                priority: candidate.priority,
                previousLevel: candidate.lastEscalationStatus,
                escalationLevel: targetEscalation,
                targetDeadline: sla.targetDeadline,
                breachedAt: targetEscalation === 'BREACHED' ? now.toISOString() : null,
              },
            },
          });

          return true;
        });

        if (didEscalate) {
          escalatedCount++;
          logger.info(`[SlaService] Escalated work item ${candidate.id} to ${targetEscalation}`, {
            workItemId: candidate.id,
            targetEscalation,
            timeRemainingMs: sla.timeRemainingMs,
          });
        } else {
          unchangedCount++;
        }
      } catch (err) {
        logger.error(`[SlaService] Failed to escalate work item ${candidate.id}`, { err });
        unchangedCount++;
      }
    }

    return {
      scanned: candidates.length,
      escalated: escalatedCount,
      unchanged: unchangedCount,
    };
  }

  /**
   * Retrieves SLA overview and urgent queue scoped to user's authorized teams
   */
  async getTeamSlaOverview(
    user: AuthenticatedUser,
    teamIdFilter?: string,
    now: Date = new Date()
  ): Promise<SlaOverviewDTO> {
    let targetTeamIds: string[];

    if (user.systemRole === 'SYSTEM_ADMIN') {
      if (teamIdFilter) {
        targetTeamIds = [teamIdFilter];
      } else {
        const allTeams = await prisma.team.findMany({ select: { id: true } });
        targetTeamIds = allTeams.map((t) => t.id);
      }
    } else {
      const userTeamIds = Array.from(user.memberships.keys());
      if (userTeamIds.length === 0) {
        return {
          totalActive: 0,
          healthyCount: 0,
          atRiskCount: 0,
          breachedCount: 0,
          urgentQueue: [],
        };
      }

      if (teamIdFilter) {
        if (!user.memberships.has(teamIdFilter)) {
          throw new NotFoundError('Team not found or you do not have permission to view it');
        }
        targetTeamIds = [teamIdFilter];
      } else {
        targetTeamIds = userTeamIds;
      }
    }

    const activeItems = await prisma.workItem.findMany({
      where: {
        teamId: { in: targetTeamIds },
        status: { notIn: [WorkItemStatus.COMPLETED, WorkItemStatus.CANCELLED] },
      },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        _count: { select: { comments: true, activities: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    });

    let healthyCount = 0;
    let atRiskCount = 0;
    let breachedCount = 0;

    const itemsWithSla: WorkItemSummaryDTO[] = activeItems.map((item) => {
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

      if (sla.status === SlaStatus.HEALTHY) healthyCount++;
      else if (sla.status === SlaStatus.AT_RISK) atRiskCount++;
      else if (sla.status === SlaStatus.BREACHED) breachedCount++;

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        type: item.type as WorkItemType,
        priority: item.priority as Priority,
        status: item.status as WorkItemStatus,
        teamId: item.teamId,
        teamName: item.team.name,
        assigneeId: item.assigneeId,
        assigneeName: item.assignee?.name ?? null,
        creatorId: item.creatorId,
        creatorName: item.creator.name,
        dueDate: item.dueDate?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        version: item.version,
        lastEscalationStatus: item.lastEscalationStatus,
        sla,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        _count: {
          comments: item._count.comments,
          activities: item._count.activities,
        },
      };
    });

    // Urgent queue: items needing immediate action (BREACHED first, then AT_RISK)
    const urgentQueue = itemsWithSla
      .filter((item) => item.sla?.isBreached || item.sla?.isAtRisk)
      .sort((a, b) => (a.sla?.timeRemainingMs ?? 0) - (b.sla?.timeRemainingMs ?? 0))
      .slice(0, 10);

    return {
      totalActive: activeItems.length,
      healthyCount,
      atRiskCount,
      breachedCount,
      urgentQueue,
    };
  }
}

export const slaService = new SlaService();
