import { prisma } from '../../shared/database/prisma';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '../../shared/errors/AppError';
import {
  TeamRole,
  Priority,
  WorkItemStatus,
  WorkItemType,
  ActivityAction,
  ALLOWED_TRANSITIONS,
  type CreateWorkItemInput,
  type UpdateWorkItemInput,
  type TransitionWorkItemInput,
  type AddCommentInput,
  type WorkItemListQuery,
  type WorkItemSummaryDTO,
  type ActivityEventDTO,
  type CommentDTO,
} from '@newtonite/shared';
import type { AuthenticatedUser } from '../../middleware/authenticate';
import { getUserRoleInTeam, hasMinimumRole } from '../../middleware/authorize';
import type { Prisma } from '@prisma/client';
import { outboxService } from '../outbox/outbox.service';
import { calculateSlaStatus } from '../sla/sla-calculator';

export class WorkItemsService {
  /**
   * Helper to format WorkItem entity into complete DTO with SLA calculations
   */
  private mapToDTO(
    item: {
      id: string;
      title: string;
      description: string | null;
      type: WorkItemType | string;
      priority: Priority | string;
      status: WorkItemStatus | string;
      teamId: string;
      team?: { name: string } | null;
      assigneeId: string | null;
      assignee?: { name: string } | null;
      creatorId: string;
      creator?: { name: string } | null;
      dueDate?: Date | string | null;
      completedAt?: Date | string | null;
      version: number;
      lastEscalationStatus?: string | null;
      createdAt: Date | string;
      updatedAt: Date | string;
      _count?: { comments: number; activities: number };
    },
    count?: { comments: number; activities: number }
  ): WorkItemSummaryDTO {
    const sla = calculateSlaStatus({
      priority: item.priority as Priority,
      createdAt: item.createdAt,
      dueDate: item.dueDate,
      status: item.status as WorkItemStatus,
      completedAt: item.completedAt,
      lastEscalationStatus: item.lastEscalationStatus,
    });

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      type: item.type as WorkItemType,
      priority: item.priority as Priority,
      status: item.status as WorkItemStatus,
      teamId: item.teamId,
      teamName: item.team?.name,
      assigneeId: item.assigneeId,
      assigneeName: item.assignee?.name || null,
      creatorId: item.creatorId,
      creatorName: item.creator?.name,
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString() : null,
      completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : null,
      version: item.version,
      lastEscalationStatus: item.lastEscalationStatus || 'NONE',
      sla,
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt).toISOString(),
      ...(count ? { _count: count } : item._count ? { _count: item._count } : {}),
    };
  }

  /**
   * Helper to decode and encode pagination cursor
   */
  private encodeCursor(item: { createdAt: Date; id: string }): string {
    const raw = JSON.stringify({ createdAt: item.createdAt.toISOString(), id: item.id });
    return Buffer.from(raw).toString('base64url');
  }

  private decodeCursor(cursorStr?: string): { createdAt: Date; id: string } | null {
    if (!cursorStr) return null;
    try {
      const decoded = Buffer.from(cursorStr, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded);
      return { createdAt: new Date(parsed.createdAt), id: parsed.id };
    } catch {
      return null;
    }
  }

  /**
   * Helper to verify user has access to a work item
   * Returns the item and the user's role in the item's team.
   * Throws 404 if item does not exist OR if user is not in the team.
   */
  private async getAccessibleItemOrThrow(user: AuthenticatedUser, itemId: string) {
    const item = await prisma.workItem.findUnique({
      where: { id: itemId },
      include: {
        team: { select: { id: true, name: true, slug: true } },
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!item) {
      throw new NotFoundError('Work item not found');
    }

    const userRole = getUserRoleInTeam(user, item.teamId);
    if (!userRole) {
      // Return 404 to avoid leaking cross-team resource existence
      throw new NotFoundError('Work item not found');
    }

    return { item, userRole };
  }

  /**
   * List accessible work items with filtering, search, and cursor pagination
   */
  async listItems(
    user: AuthenticatedUser,
    query: WorkItemListQuery
  ): Promise<{ items: WorkItemSummaryDTO[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(query.limit || 20, 50);

    // Determine accessible teams
    let targetTeamIds: string[];
    if (user.systemRole === 'SYSTEM_ADMIN') {
      if (query.teamId) {
        targetTeamIds = [query.teamId];
      } else {
        const allTeams = await prisma.team.findMany({ select: { id: true } });
        targetTeamIds = allTeams.map((t) => t.id);
      }
    } else {
      const userTeamIds = Array.from(user.memberships.keys());
      if (userTeamIds.length === 0) {
        return { items: [], nextCursor: null, hasMore: false };
      }

      if (query.teamId) {
        if (!user.memberships.has(query.teamId)) {
          throw new ForbiddenError('Access denied: You are not a member of the requested team');
        }
        targetTeamIds = [query.teamId];
      } else {
        targetTeamIds = userTeamIds;
      }
    }

    const where: Prisma.WorkItemWhereInput = {
      teamId: { in: targetTeamIds },
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }

    if (query.search) {
      const searchTerms = query.search.trim();
      where.OR = [
        { title: { contains: searchTerms, mode: 'insensitive' } },
        { description: { contains: searchTerms, mode: 'insensitive' } },
      ];
    }

    const cursorData = this.decodeCursor(query.cursor);
    if (cursorData) {
      where.OR = [
        { createdAt: { lt: cursorData.createdAt } },
        { createdAt: cursorData.createdAt, id: { lt: cursorData.id } },
      ];
    }

    // Query limit + 1 to determine if there is a next page
    const records = await prisma.workItem.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        _count: {
          select: {
            comments: true,
            activities: true,
          },
        },
      },
    });

    const hasMore = records.length > limit;
    const itemsToReturn = hasMore ? records.slice(0, limit) : records;

    const nextCursor =
      hasMore && itemsToReturn.length > 0
        ? this.encodeCursor(itemsToReturn[itemsToReturn.length - 1])
        : null;

    const dtos: WorkItemSummaryDTO[] = itemsToReturn.map((item) => this.mapToDTO(item));

    return {
      items: dtos,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Get single work item by ID
   */
  async getItemById(user: AuthenticatedUser, itemId: string): Promise<WorkItemSummaryDTO> {
    const { item } = await this.getAccessibleItemOrThrow(user, itemId);

    const counts = await prisma.workItem.findUnique({
      where: { id: itemId },
      select: {
        _count: {
          select: { comments: true, activities: true },
        },
      },
    });

    return this.mapToDTO(item, counts?._count);
  }

  /**
   * Create work item transactionally with initial ActivityEvent
   */
  async createItem(
    user: AuthenticatedUser,
    input: CreateWorkItemInput
  ): Promise<WorkItemSummaryDTO> {
    const role = getUserRoleInTeam(user, input.teamId);
    if (!role) {
      throw new ForbiddenError('Access denied: You are not a member of the target team');
    }

    if (!hasMinimumRole(role, TeamRole.MEMBER)) {
      throw new ForbiddenError('Viewers do not have permission to create work items');
    }

    // If assigneeId is provided, verify assignee belongs to the same team
    if (input.assigneeId) {
      const assigneeMembership = await prisma.membership.findUnique({
        where: {
          userId_teamId: {
            userId: input.assigneeId,
            teamId: input.teamId,
          },
        },
      });

      if (!assigneeMembership) {
        throw new BadRequestError('Assignee must be an active member of the designated team');
      }
    }

    // Atomic transaction: create item + append activity record
    const createdItem = await prisma.$transaction(async (tx) => {
      const item = await tx.workItem.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          priority: input.priority || 'MEDIUM',
          status: WorkItemStatus.BACKLOG,
          teamId: input.teamId,
          assigneeId: input.assigneeId || null,
          creatorId: user.id,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          version: 1,
        },
        include: {
          team: { select: { name: true } },
          assignee: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });

      await tx.activityEvent.create({
        data: {
          workItemId: item.id,
          actorId: user.id,
          action: ActivityAction.CREATED,
          newState: {
            title: item.title,
            type: item.type,
            priority: item.priority,
            status: item.status,
            assigneeId: item.assigneeId,
          },
        },
      });

      await outboxService.scheduleJob(tx, {
        aggregateType: 'WORK_ITEM',
        aggregateId: item.id,
        eventType: 'WORK_ITEM_CREATED',
        payload: {
          id: item.id,
          title: item.title,
          teamId: item.teamId,
          creatorId: user.id,
          status: item.status,
          version: item.version,
        },
      });

      return item;
    });

    return this.mapToDTO(createdItem);
  }

  /**
   * Update work item permitted fields transactionally
   */
  async updateItem(
    user: AuthenticatedUser,
    itemId: string,
    input: UpdateWorkItemInput
  ): Promise<WorkItemSummaryDTO> {
    const { item, userRole } = await this.getAccessibleItemOrThrow(user, itemId);

    if (!hasMinimumRole(userRole, TeamRole.MEMBER)) {
      throw new ForbiddenError('Viewers do not have permission to modify work items');
    }

    if (input.assigneeId !== undefined && input.assigneeId !== null) {
      const assigneeMembership = await prisma.membership.findUnique({
        where: {
          userId_teamId: {
            userId: input.assigneeId,
            teamId: item.teamId,
          },
        },
      });

      if (!assigneeMembership) {
        throw new BadRequestError('Assignee must be an active member of the designated team');
      }
    }

    const previousState: Record<string, unknown> = {};
    const newState: Record<string, unknown> = {};

    if (input.title !== undefined && input.title !== item.title) {
      previousState.title = item.title;
      newState.title = input.title;
    }
    if (input.description !== undefined && input.description !== item.description) {
      previousState.description = item.description;
      newState.description = input.description;
    }
    if (input.priority !== undefined && input.priority !== item.priority) {
      previousState.priority = item.priority;
      newState.priority = input.priority;
    }
    if (input.dueDate !== undefined) {
      const newDue = input.dueDate ? new Date(input.dueDate).toISOString() : null;
      const oldDue = item.dueDate ? item.dueDate.toISOString() : null;
      if (newDue !== oldDue) {
        previousState.dueDate = oldDue;
        newState.dueDate = newDue;
      }
    }
    if (input.assigneeId !== undefined && input.assigneeId !== item.assigneeId) {
      previousState.assigneeId = item.assigneeId;
      newState.assigneeId = input.assigneeId;
    }

    // Atomic transaction: update item version + append activity event + outbox job
    const updated = await prisma.$transaction(async (tx) => {
      if (input.version !== undefined) {
        const updateResult = await tx.workItem.updateMany({
          where: {
            id: itemId,
            version: input.version,
          },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.dueDate !== undefined
              ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
              : {}),
            ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          const latest = await tx.workItem.findUnique({
            where: { id: itemId },
            select: { version: true, updatedAt: true, title: true, status: true },
          });
          throw new ConflictError(
            `Stale update rejected: Work item has been modified by another user (current version: ${latest?.version}, submitted: ${input.version})`,
            {
              currentVersion: latest?.version,
              submittedVersion: input.version,
              updatedAt: latest?.updatedAt?.toISOString(),
            }
          );
        }
      } else {
        await tx.workItem.update({
          where: { id: itemId },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.dueDate !== undefined
              ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
              : {}),
            ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
            version: { increment: 1 },
          },
        });
      }

      const res = await tx.workItem.findUniqueOrThrow({
        where: { id: itemId },
        include: {
          team: { select: { name: true } },
          assignee: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });

      let action: ActivityAction = ActivityAction.UPDATED;
      if (previousState.priority !== undefined && Object.keys(newState).length === 1) {
        action = ActivityAction.PRIORITY_CHANGED;
      } else if (previousState.assigneeId !== undefined) {
        action = input.assigneeId ? ActivityAction.ASSIGNED : ActivityAction.UNASSIGNED;
      }

      await tx.activityEvent.create({
        data: {
          workItemId: itemId,
          actorId: user.id,
          action,
          previousState: previousState as Prisma.InputJsonValue,
          newState: newState as Prisma.InputJsonValue,
        },
      });

      await outboxService.scheduleJob(tx, {
        aggregateType: 'WORK_ITEM',
        aggregateId: itemId,
        eventType: 'WORK_ITEM_UPDATED',
        payload: {
          id: itemId,
          version: res.version,
          previousState,
          newState,
        },
      });

      return res;
    });

    return this.mapToDTO(updated);
  }

  /**
   * Claim an unassigned work item
   */
  async claimItem(user: AuthenticatedUser, itemId: string): Promise<WorkItemSummaryDTO> {
    const { userRole } = await this.getAccessibleItemOrThrow(user, itemId);

    if (!hasMinimumRole(userRole, TeamRole.MEMBER)) {
      throw new ForbiddenError('Viewers do not have permission to claim work items');
    }

    // Atomic transaction: assign to caller using conditional update to prevent race conditions
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Fetch fresh snapshot inside transaction
      const current = await tx.workItem.findUniqueOrThrow({
        where: { id: itemId },
        include: {
          assignee: { select: { id: true, name: true } },
        },
      });

      if (current.assigneeId !== null) {
        throw new ConflictError(
          `Work item is already claimed by ${current.assignee?.name || (current.assigneeId === user.id ? 'you' : 'another team member')}`,
          {
            claimedBy: current.assignee?.name,
            claimedById: current.assigneeId,
            currentVersion: current.version,
            currentStatus: current.status,
          }
        );
      }

      const nextStatus =
        current.status === WorkItemStatus.BACKLOG || current.status === WorkItemStatus.TRIAGED
          ? WorkItemStatus.IN_PROGRESS
          : current.status;

      // 2. Atomic conditional update: update ONLY IF assigneeId is still null
      const claimResult = await tx.workItem.updateMany({
        where: {
          id: itemId,
          assigneeId: null, // Critical condition: ensure unassigned
        },
        data: {
          assigneeId: user.id,
          status: nextStatus,
          version: { increment: 1 },
        },
      });

      // 3. If affected row count is 0, another concurrent request claimed it first!
      if (claimResult.count === 0) {
        const raceWinner = await tx.workItem.findUnique({
          where: { id: itemId },
          include: { assignee: { select: { id: true, name: true } } },
        });

        throw new ConflictError(
          `Work item is already claimed by ${raceWinner?.assignee?.name || 'another team member'}`,
          {
            claimedBy: raceWinner?.assignee?.name,
            claimedById: raceWinner?.assigneeId,
            currentVersion: raceWinner?.version,
            currentStatus: raceWinner?.status,
          }
        );
      }

      const res = await tx.workItem.findUniqueOrThrow({
        where: { id: itemId },
        include: {
          team: { select: { name: true } },
          assignee: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });

      await tx.activityEvent.create({
        data: {
          workItemId: itemId,
          actorId: user.id,
          action: ActivityAction.CLAIMED,
          previousState: {
            assigneeId: current.assigneeId,
            status: current.status,
          },
          newState: {
            assigneeId: user.id,
            status: nextStatus,
          },
        },
      });

      await outboxService.scheduleJob(tx, {
        aggregateType: 'WORK_ITEM',
        aggregateId: itemId,
        eventType: 'WORK_ITEM_CLAIMED',
        payload: {
          id: itemId,
          claimedById: user.id,
          claimedByName: user.name,
          version: res.version,
          status: nextStatus,
        },
      });

      return res;
    });

    return this.mapToDTO(updated);
  }

  /**
   * Transition work item through server-enforced state machine
   */
  async transitionItem(
    user: AuthenticatedUser,
    itemId: string,
    input: TransitionWorkItemInput
  ): Promise<WorkItemSummaryDTO> {
    const { item, userRole } = await this.getAccessibleItemOrThrow(user, itemId);

    if (!hasMinimumRole(userRole, TeamRole.MEMBER)) {
      throw new ForbiddenError('Viewers do not have permission to transition work items');
    }

    const currentStatus = item.status as WorkItemStatus;
    const targetStatus = input.targetStatus;

    if (currentStatus === targetStatus) {
      throw new BadRequestError(`Work item is already in '${currentStatus}' status`);
    }

    // Validate against allowed transitions matrix
    const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid workflow transition from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowedTargets.join(', ')}]`
      );
    }

    // Role-based workflow approval enforcement:
    // Transitioning from IN_REVIEW to COMPLETED requires LEAD or ADMIN role!
    const isApprovalTransition =
      currentStatus === WorkItemStatus.IN_REVIEW && targetStatus === WorkItemStatus.COMPLETED;
    if (isApprovalTransition && !hasMinimumRole(userRole, TeamRole.LEAD)) {
      throw new ForbiddenError(
        'Workflow approval requires Lead or Admin role. Members cannot complete items in review.'
      );
    }

    // Re-opening completed or cancelled items requires LEAD or ADMIN role
    const isReopen =
      (currentStatus === WorkItemStatus.COMPLETED && targetStatus === WorkItemStatus.IN_PROGRESS) ||
      (currentStatus === WorkItemStatus.CANCELLED && targetStatus === WorkItemStatus.BACKLOG);
    if (isReopen && !hasMinimumRole(userRole, TeamRole.LEAD)) {
      throw new ForbiddenError(
        'Re-opening completed or cancelled items requires Lead or Admin role'
      );
    }

    // Atomic transaction: status update + activity audit
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.workItem.update({
        where: { id: itemId },
        data: {
          status: targetStatus,
          completedAt: targetStatus === WorkItemStatus.COMPLETED ? new Date() : null,
          version: { increment: 1 },
        },
        include: {
          team: { select: { name: true } },
          assignee: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });

      const action = isApprovalTransition
        ? ActivityAction.WORKFLOW_APPROVED
        : ActivityAction.STATUS_CHANGED;

      await tx.activityEvent.create({
        data: {
          workItemId: itemId,
          actorId: user.id,
          action,
          previousState: { status: currentStatus },
          newState: { status: targetStatus },
          metadata: input.reason ? { reason: input.reason } : undefined,
        },
      });

      await outboxService.scheduleJob(tx, {
        aggregateType: 'WORK_ITEM',
        aggregateId: itemId,
        eventType: 'WORK_ITEM_STATUS_CHANGED',
        payload: {
          id: itemId,
          previousStatus: currentStatus,
          targetStatus,
          version: res.version,
          reason: input.reason,
          isApproval: isApprovalTransition,
        },
      });

      return res;
    });

    return this.mapToDTO(updated);
  }

  /**
   * Retrieve append-only activity audit history for an item
   */
  async getActivityHistory(user: AuthenticatedUser, itemId: string): Promise<ActivityEventDTO[]> {
    await this.getAccessibleItemOrThrow(user, itemId);

    const events = await prisma.activityEvent.findMany({
      where: { workItemId: itemId },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return events.map((event) => ({
      id: event.id,
      workItemId: event.workItemId,
      actorId: event.actorId,
      actorName: event.actor?.name || null,
      actorEmail: event.actor?.email || null,
      action: event.action as ActivityAction,
      previousState: (event.previousState as Record<string, unknown>) || null,
      newState: (event.newState as Record<string, unknown>) || null,
      metadata: (event.metadata as Record<string, unknown>) || null,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  /**
   * Add a comment to a work item
   */
  async addComment(
    user: AuthenticatedUser,
    itemId: string,
    input: AddCommentInput
  ): Promise<CommentDTO> {
    const { userRole } = await this.getAccessibleItemOrThrow(user, itemId);

    if (!hasMinimumRole(userRole, TeamRole.MEMBER)) {
      throw new ForbiddenError('Viewers do not have permission to comment on work items');
    }

    // Atomic transaction: create comment + record activity event
    const comment = await prisma.$transaction(async (tx) => {
      const createdComment = await tx.comment.create({
        data: {
          workItemId: itemId,
          authorId: user.id,
          body: input.body,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.activityEvent.create({
        data: {
          workItemId: itemId,
          actorId: user.id,
          action: ActivityAction.COMMENT_ADDED,
          metadata: {
            commentId: createdComment.id,
            preview: input.body.slice(0, 80),
          },
        },
      });

      return createdComment;
    });

    return {
      id: comment.id,
      workItemId: comment.workItemId,
      authorId: comment.authorId,
      authorName: comment.author.name,
      authorEmail: comment.author.email,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  /**
   * Get comments for a work item
   */
  async getComments(user: AuthenticatedUser, itemId: string): Promise<CommentDTO[]> {
    await this.getAccessibleItemOrThrow(user, itemId);

    const comments = await prisma.comment.findMany({
      where: { workItemId: itemId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return comments.map((c) => ({
      id: c.id,
      workItemId: c.workItemId,
      authorId: c.authorId,
      authorName: c.author.name,
      authorEmail: c.author.email,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }
}

export const workItemsService = new WorkItemsService();
