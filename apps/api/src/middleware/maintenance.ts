import type { Request, Response, NextFunction } from 'express';
import { settingsService } from '../modules/settings/settings.service';
import { ServiceUnavailableError } from '../shared/errors/AppError';
import { TeamRole } from '@newtonite/shared';

/**
 * Maintenance Mode Middleware:
 * When maintenance mode is active, blocks state-mutating requests (POST, PUT, PATCH, DELETE)
 * on operational resources unless caller is an Administrator.
 */
export async function maintenanceModeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // Only intercept mutating actions
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Exclude auth routes (so admins can log in) and settings routes (so admins can toggle it back off)
    if (
      req.path.startsWith('/auth') ||
      req.path.startsWith('/settings') ||
      req.path.includes('/auth') ||
      req.path.includes('/settings')
    ) {
      return next();
    }

    try {
      const isMaintenance = await settingsService.isMaintenanceMode();
      const enforceInTest =
        process.env.NODE_ENV !== 'test' || req.headers['x-test-maintenance'] === 'true';

      if (isMaintenance && enforceInTest) {
        const user = req.user;
        const isAdmin =
          user &&
          (user.systemRole === 'SYSTEM_ADMIN' ||
            Array.from(user.memberships.values()).includes(TeamRole.ADMIN));

        if (!isAdmin) {
          return next(
            new ServiceUnavailableError(
              'Maintenance mode is active. Operational modifications are paused for non-administrators.'
            )
          );
        }
      }
    } catch {
      // In case of settings read error, continue safely
    }
  }

  next();
}
