import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../shared/errors/AppError';
import { prisma } from '../shared/database/prisma';
import type { SystemRole, TeamRole } from '@newtonite/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  systemRole: SystemRole;
  memberships: Map<string, TeamRole>; // teamId -> role
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface JwtPayload {
  sub: string;
  email: string;
  systemRole: SystemRole;
  iat?: number;
  exp?: number;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authentication token is required'));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(new UnauthorizedError('Authentication token is missing'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (!decoded.sub) {
      return next(new UnauthorizedError('Malformed authentication token payload'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        memberships: {
          select: { teamId: true, role: true },
        },
      },
    });

    if (!user) {
      return next(new UnauthorizedError('User account no longer exists'));
    }

    if (!user.isActive) {
      return next(new UnauthorizedError('User account is deactivated'));
    }

    const membershipMap = new Map<string, TeamRole>();
    for (const m of user.memberships) {
      membershipMap.set(m.teamId, m.role as TeamRole);
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      systemRole: user.systemRole as SystemRole,
      memberships: membershipMap,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Authentication token has expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError('Invalid authentication token signature or format'));
    }
    return next(error);
  }
}
