import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/database/prisma';
import {
  TeamRole,
  SystemRole,
  type TeamMemberAdminDTO,
  type UserSummaryDTO,
  type CreateUserAdminInput,
  type AddTeamMemberInput,
} from '@newtonite/shared';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logger/logger';

export class TeamsAdminService {
  /**
   * Lists all system users with their team memberships for admin view and selection.
   */
  async listAllUsers(search?: string): Promise<UserSummaryDTO[]> {
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        memberships: {
          include: {
            team: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      systemRole: u.systemRole as SystemRole,
      createdAt: u.createdAt.toISOString(),
      memberships: u.memberships.map((m) => ({
        id: m.id,
        teamId: m.teamId,
        teamName: m.team.name,
        role: m.role as TeamRole,
      })),
    }));
  }

  /**
   * Creates a new user in the system and optionally assigns them to a team.
   */
  async createUser(input: CreateUserAdminInput, actorId: string): Promise<UserSummaryDTO> {
    const emailNormalized = input.email.toLowerCase().trim();

    const existing = await prisma.user.findFirst({
      where: {
        email: {
          equals: emailNormalized,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new BadRequestError(`A user with email '${emailNormalized}' already exists.`);
    }

    if (input.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: input.teamId },
      });
      if (!team) {
        throw new NotFoundError('Selected team does not exist');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name.trim(),
          email: emailNormalized,
          passwordHash,
          systemRole: input.systemRole === 'SYSTEM_ADMIN' ? 'SYSTEM_ADMIN' : 'USER',
          isActive: true,
        },
      });

      if (input.teamId) {
        await tx.membership.create({
          data: {
            userId: user.id,
            teamId: input.teamId,
            role: input.teamRole || 'MEMBER',
          },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          memberships: {
            include: {
              team: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    });

    logger.info('[TeamsAdminService] New user created by admin', {
      userId: newUser.id,
      email: newUser.email,
      systemRole: newUser.systemRole,
      teamId: input.teamId,
      actorId,
    });

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      isActive: newUser.isActive,
      systemRole: newUser.systemRole as SystemRole,
      createdAt: newUser.createdAt.toISOString(),
      memberships: newUser.memberships.map((m) => ({
        id: m.id,
        teamId: m.teamId,
        teamName: m.team.name,
        role: m.role as TeamRole,
      })),
    };
  }

  /**
   * Adds an existing user to a team with a designated role.
   */
  async addMemberToTeam(teamId: string, input: AddTeamMemberInput, actorId: string): Promise<void> {
    const [team, user] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId } }),
      prisma.user.findUnique({ where: { id: input.userId } }),
    ]);

    if (!team) {
      throw new NotFoundError('Team not found');
    }
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: input.userId,
          teamId,
        },
      },
    });

    if (existingMembership) {
      throw new BadRequestError(`User '${user.name}' is already a member of team '${team.name}'.`);
    }

    await prisma.membership.create({
      data: {
        userId: input.userId,
        teamId,
        role: input.role,
      },
    });

    logger.info('[TeamsAdminService] Member added to team', {
      teamId,
      userId: input.userId,
      role: input.role,
      actorId,
    });
  }

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
