import type { Request, Response, NextFunction } from 'express';
import { TeamRole } from '@newtonite/shared';
import { ForbiddenError, UnauthorizedError, BadRequestError } from '../shared/errors/AppError';
import type { AuthenticatedUser } from './authenticate';

export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  [TeamRole.VIEWER]: 1,
  [TeamRole.MEMBER]: 2,
  [TeamRole.LEAD]: 3,
  [TeamRole.ADMIN]: 4,
};

export function hasMinimumRole(actualRole: TeamRole, requiredRole: TeamRole): boolean {
  return ROLE_HIERARCHY[actualRole] >= ROLE_HIERARCHY[requiredRole];
}

export function getUserRoleInTeam(user: AuthenticatedUser, teamId: string): TeamRole | null {
  if (user.systemRole === 'SYSTEM_ADMIN') {
    return TeamRole.ADMIN;
  }
  return user.memberships.get(teamId) || null;
}

export function requireTeamRole(
  minRole: TeamRole,
  getTeamId?: (req: Request) => string | undefined
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const teamId =
      (getTeamId ? getTeamId(req) : undefined) ||
      (req.params.teamId as string | undefined) ||
      (req.body?.teamId as string | undefined) ||
      (req.query?.teamId as string | undefined);

    if (!teamId) {
      return next(new BadRequestError('Team context is required for authorization'));
    }

    const role = getUserRoleInTeam(req.user, teamId);

    if (!role) {
      return next(new ForbiddenError('Access denied: You are not a member of this team'));
    }

    if (!hasMinimumRole(role, minRole)) {
      return next(
        new ForbiddenError(
          `Action requires '${minRole}' role or higher in this team. Current role: '${role}'`
        )
      );
    }

    next();
  };
}
