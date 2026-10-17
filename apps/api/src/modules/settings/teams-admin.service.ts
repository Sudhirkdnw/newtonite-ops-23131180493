import { prisma } from '../../shared/database/prisma';
import { TeamRole, type TeamMemberAdminDTO } from '@newtonite/shared';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logger/logger';

export class TeamsAdminService {
  /**
   * Lists all teams with their member counts.
   */
  async listAllTeams() {
    return prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { memberships: true, workItems: true },
        },
      },
    });
  }

  /**
   * Lists all members across all teams (or filtered by teamId) for administrative access control.
   */
  async listMembers(teamId?: string): Promise<TeamMemberAdminDTO[]> {
    const memberships = await prisma.membership.findMany({
      where: teamId ? { teamId } : undefined,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            systemRole: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ team: { name: 'asc' } }, { role: 'desc' }, { user: { name: 'asc' } }],
    });

    return memberships.map((m) => ({
      id: m.id,
      userId: m.user.id,
      userName: m.user.name,
      userEmail: m.user.email,
      userIsActive: m.user.isActive,
      systemRole: m.user.systemRole,
      role: m.role as TeamRole,
      teamId: m.team.id,
      teamName: m.team.name,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Updates a user's role within a team, protecting the last active administrator.
   */
  async updateMemberRole(
    teamId: string,
    membershipId: string,
    newRole: TeamRole,
    actorId: string
  ): Promise<void> {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: true },
    });

    if (!membership || membership.teamId !== teamId) {
      throw new NotFoundError('Team membership not found');
    }

    // Safety check: Prevent removing/demoting the last active admin
    if (membership.role === TeamRole.ADMIN && newRole !== TeamRole.ADMIN) {
      const otherAdminsCount = await prisma.membership.count({
        where: {
          teamId,
          role: TeamRole.ADMIN,
          id: { not: membershipId },
          user: { isActive: true },
        },
      });

      if (otherAdminsCount === 0) {
        throw new BadRequestError(
          'Cannot demote this user: A team must have at least one active Administrator.'
        );
      }

      if (membership.userId === actorId) {
        throw new BadRequestError('Safety Guard: You cannot demote your own administrative role.');
      }
    }

    await prisma.membership.update({
      where: { id: membershipId },
      data: { role: newRole },
    });

    logger.info('[TeamsAdminService] Member role updated', {
      teamId,
      membershipId,
      oldRole: membership.role,
      newRole,
      actorId,
    });
  }

  /**
   * Removes a member from a team, protecting the last active administrator.
   */
  async removeMember(teamId: string, membershipId: string, actorId: string): Promise<void> {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: true },
    });

    if (!membership || membership.teamId !== teamId) {
      throw new NotFoundError('Team membership not found');
    }

    if (membership.role === TeamRole.ADMIN) {
      const otherAdminsCount = await prisma.membership.count({
        where: {
          teamId,
          role: TeamRole.ADMIN,
          id: { not: membershipId },
          user: { isActive: true },
        },
      });

      if (otherAdminsCount === 0) {
        throw new BadRequestError(
          'Cannot remove this user: A team must have at least one active Administrator.'
        );
      }

      if (membership.userId === actorId) {
        throw new BadRequestError('Safety Guard: You cannot remove yourself from the team.');
      }
    }

    await prisma.membership.delete({
      where: { id: membershipId },
    });

    logger.info('[TeamsAdminService] Member removed from team', {
      teamId,
      membershipId,
      actorId,
    });
  }

  /**
   * Toggles user account activation status (active/deactivated), protecting active admins.
   */
  async toggleUserActive(userId: string, isActive: boolean, actorId: string): Promise<void> {
    if (userId === actorId && !isActive) {
      throw new BadRequestError('Safety Guard: You cannot deactivate your own account.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { role: TeamRole.ADMIN },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // If deactivating an admin user, verify each team they administer has at least one other active admin
    if (!isActive && user.memberships.length > 0) {
      for (const m of user.memberships) {
        const otherAdmins = await prisma.membership.count({
          where: {
            teamId: m.teamId,
            role: TeamRole.ADMIN,
            userId: { not: userId },
            user: { isActive: true },
          },
        });

        if (otherAdmins === 0) {
          throw new BadRequestError(
            `Cannot deactivate user: They are the sole active Administrator for team ${m.teamId}. Reassign another administrator first.`
          );
        }
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    logger.info('[TeamsAdminService] User active status updated', {
      userId,
      isActive,
      actorId,
    });
  }
}

export const teamsAdminService = new TeamsAdminService();
