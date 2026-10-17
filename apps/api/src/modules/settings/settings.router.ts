import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  SettingsCategory,
  GeneralSettingsSchema,
  BrandingSettingsSchema,
  EmailSettingsSchema,
  SendTestEmailSchema,
  SlaSettingsSchema,
  WorkflowSettingsSchema,
  SecuritySettingsSchema,
  NotificationSettingsSchema,
  UpdateTeamMemberRoleSchema,
  ToggleUserActiveSchema,
  TeamRole,
} from '@newtonite/shared';
import { authenticate } from '../../middleware/authenticate';
import { settingsService } from './settings.service';
import { emailService } from './email.service';
import { teamsAdminService } from './teams-admin.service';
import { jobsAdminService } from './jobs-admin.service';
import { auditService } from './audit.service';
import { ForbiddenError, BadRequestError } from '../../shared/errors/AppError';
import { sendSuccess } from '../../shared/http/response';

export const settingsRouter = Router();

/**
 * Middleware: Verify caller has administrative privileges (SYSTEM_ADMIN or ADMIN in at least one team).
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new ForbiddenError('Authentication required'));
  }

  const isSystemAdmin = req.user.systemRole === 'SYSTEM_ADMIN';
  const hasTeamAdminRole = Array.from(req.user.memberships.values()).includes(TeamRole.ADMIN);

  if (!isSystemAdmin && !hasTeamAdminRole) {
    return next(
      new ForbiddenError('Access denied: Administrative privileges required to manage Settings')
    );
  }

  next();
}

// ==========================================
// 1. Public Routes
// ==========================================

// Public branding endpoint (accessible to unauthenticated clients / login screen)
settingsRouter.get('/public/branding', async (_req, res, next) => {
  try {
    const branding = await settingsService.getPublicBranding();
    return sendSuccess(res, branding);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. Authenticated Administrative Routes
// ==========================================

settingsRouter.use(authenticate);
settingsRouter.use(requireAdmin);

// --- Sub-services Routes (must come before /:category wildcard) ---

// Teams & Members Administration
settingsRouter.get('/teams/all', async (_req, res, next) => {
  try {
    const teams = await teamsAdminService.listAllTeams();
    return sendSuccess(res, teams);
  } catch (err) {
    next(err);
  }
});

settingsRouter.get('/teams/members', async (req, res, next) => {
  try {
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;
    const members = await teamsAdminService.listMembers(teamId);
    return sendSuccess(res, members);
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch('/teams/:teamId/members/:membershipId/role', async (req, res, next) => {
  try {
    const parsed = UpdateTeamMemberRoleSchema.parse(req.body);
    await teamsAdminService.updateMemberRole(
      req.params.teamId,
      req.params.membershipId,
      parsed.role,
      req.user!.id
    );
    return sendSuccess(res, { message: 'Role updated successfully' });
  } catch (err) {
    next(err);
  }
});

settingsRouter.delete('/teams/:teamId/members/:membershipId', async (req, res, next) => {
  try {
    await teamsAdminService.removeMember(req.params.teamId, req.params.membershipId, req.user!.id);
    return sendSuccess(res, { message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch('/users/:userId/active', async (req, res, next) => {
  try {
    const parsed = ToggleUserActiveSchema.parse(req.body);
    await teamsAdminService.toggleUserActive(req.params.userId, parsed.isActive, req.user!.id);
    return sendSuccess(res, { message: 'User status updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Email Actions
settingsRouter.post('/email/test-connection', async (req, res, next) => {
  try {
    const result = await emailService.testConnection(req.user?.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

settingsRouter.post('/email/send-test', async (req, res, next) => {
  try {
    const parsed = SendTestEmailSchema.parse(req.body);
    const result = await emailService.sendTestEmail(parsed.recipientEmail, req.user?.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Branding Logo Upload Action
settingsRouter.post('/branding/logo', async (req, res, next) => {
  try {
    const { logoData } = req.body;
    if (!logoData || typeof logoData !== 'string') {
      throw new BadRequestError('logoData must be provided as a base64 or URL string');
    }

    // Size limit: 2MB in base64 is approx 2.8 million characters
    if (logoData.length > 3_000_000) {
      throw new BadRequestError('Image asset exceeds maximum allowed size (2MB)');
    }

    // MIME type check if data URL
    if (logoData.startsWith('data:')) {
      const mime = logoData.split(';')[0].replace('data:', '');
      const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
      if (!allowed.includes(mime)) {
        throw new BadRequestError(`Unsupported image type: ${mime}. Allowed: PNG, JPEG, SVG, WEBP`);
      }
    }

    const updated = await settingsService.updateSettings(
      'branding',
      { logoUrl: logoData },
      req.user?.id
    );

    return sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// Background Jobs & Queue Health
settingsRouter.get('/jobs/stats', async (_req, res, next) => {
  try {
    const stats = await jobsAdminService.getQueueStats();
    return sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
});

settingsRouter.post('/jobs/:id/retry', async (req, res, next) => {
  try {
    const job = await jobsAdminService.retryJob(req.params.id, req.user!.id);
    return sendSuccess(res, job);
  } catch (err) {
    next(err);
  }
});

// Audit History
settingsRouter.get('/audit/history', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20;

    const result = await auditService.getAuditHistory({ category, page, limit });
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// --- Dynamic Category Get & Update ---

settingsRouter.get('/:category', async (req, res, next) => {
  try {
    const cat = req.params.category as SettingsCategory;
    const valid = Object.values(SettingsCategory).includes(cat);
    if (!valid) {
      throw new BadRequestError(`Unknown settings category '${req.params.category}'`);
    }

    if (cat === 'email') {
      const data = await settingsService.getEmailSettingsSafe();
      return sendSuccess(res, data);
    }

    const data = await settingsService.getSettings(cat);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

settingsRouter.put('/:category', async (req, res, next) => {
  try {
    const cat = req.params.category as SettingsCategory;
    let validatedData: Record<string, unknown>;

    switch (cat) {
      case SettingsCategory.GENERAL:
        validatedData = GeneralSettingsSchema.parse(req.body);
        break;
      case SettingsCategory.BRANDING:
        validatedData = BrandingSettingsSchema.parse(req.body);
        break;
      case SettingsCategory.EMAIL:
        validatedData = EmailSettingsSchema.parse(req.body);
        break;
      case SettingsCategory.SLA:
        validatedData = SlaSettingsSchema.parse(req.body);
        break;
      case SettingsCategory.WORKFLOW:
        validatedData = WorkflowSettingsSchema.parse(req.body);
        break;
      case SettingsCategory.SECURITY:
        validatedData = SecuritySettingsSchema.parse(req.body);
        break;
      case SettingsCategory.NOTIFICATION:
        validatedData = NotificationSettingsSchema.parse(req.body);
        break;
      default:
        throw new BadRequestError(`Unknown settings category '${req.params.category}'`);
    }

    const updated = await settingsService.updateSettings(cat, validatedData, req.user?.id);

    if (cat === 'email') {
      const safe = await settingsService.getEmailSettingsSafe();
      return sendSuccess(res, safe);
    }

    return sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});
