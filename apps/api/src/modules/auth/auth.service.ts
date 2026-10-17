import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../shared/database/prisma';
import { UnauthorizedError, NotFoundError } from '../../shared/errors/AppError';
import type {
  LoginInput,
  AuthResponse,
  UserProfile,
  TeamRole,
  SystemRole,
} from '@newtonite/shared';

export class AuthService {
  async login(input: LoginInput): Promise<AuthResponse> {
    const emailNormalized = input.email.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: emailNormalized,
          mode: 'insensitive',
        },
      },
      include: {
        memberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        systemRole: user.systemRole,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    const memberships = user.memberships.map((m) => ({
      teamId: m.teamId,
      teamName: m.team.name,
      teamSlug: m.team.slug,
      role: m.role as TeamRole,
    }));

    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      systemRole: user.systemRole as SystemRole,
      memberships,
    };

    return {
      token,
      user: userProfile,
    };
  }

  async getMe(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundError('User profile not found or inactive');
    }

    const memberships = user.memberships.map((m) => ({
      teamId: m.teamId,
      teamName: m.team.name,
      teamSlug: m.team.slug,
      role: m.role as TeamRole,
    }));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      systemRole: user.systemRole as SystemRole,
      memberships,
    };
  }
}

export const authService = new AuthService();
