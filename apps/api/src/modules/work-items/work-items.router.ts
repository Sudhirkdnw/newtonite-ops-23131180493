import { Router, type Request, type Response, type NextFunction } from 'express';
import { workItemsService } from './work-items.service';
import { slaService } from '../sla/sla.service';
import { authenticate } from '../../middleware/authenticate';
import { idempotencyMiddleware } from '../../middleware/idempotency';
import { validateRequest } from '../../shared/validation/validate';
import { sendSuccess } from '../../shared/http/response';
import {
  CreateWorkItemSchema,
  UpdateWorkItemSchema,
  TransitionWorkItemSchema,
  AddCommentSchema,
  WorkItemListQuerySchema,
} from '@newtonite/shared';

export const workItemsRouter = Router();

// All work-item endpoints require authentication
workItemsRouter.use(authenticate);

// 1. POST /api/v1/items — create a work item with idempotency support
workItemsRouter.post(
  '/',
  idempotencyMiddleware,
  validateRequest({ body: CreateWorkItemSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await workItemsService.createItem(req.user!, req.body);
      return sendSuccess(res, item, 201);
    } catch (error) {
      next(error);
    }
  }
);

// 2. GET /api/v1/items — list accessible items with filtering, search, and pagination
workItemsRouter.get(
  '/',
  validateRequest({ query: WorkItemListQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Cast req.query as parsed by Zod in validateRequest
      const query = req.query as unknown as import('@newtonite/shared').WorkItemListQuery;
      const { items, nextCursor, hasMore } = await workItemsService.listItems(req.user!, query);
      return sendSuccess(res, items, 200, {
        limit: query.limit || 20,
        hasMore,
        nextCursor,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 2.1 GET /api/v1/items/sla/overview — team-scoped SLA overview & urgent queue
workItemsRouter.get('/sla/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;
    const overview = await slaService.getTeamSlaOverview(req.user!, teamId);
    return sendSuccess(res, overview, 200);
  } catch (error) {
    next(error);
  }
});

// 2.2 POST /api/v1/items/sla/escalate — run SLA scan and idempotent escalation
workItemsRouter.post('/sla/escalate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = typeof req.body?.teamId === 'string' ? req.body.teamId : undefined;
    const now = req.body?.now ? new Date(req.body.now) : undefined;
    const result = await slaService.scanAndEscalate({ now, teamId });
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
});

// 3. GET /api/v1/items/:id — retrieve an accessible item
workItemsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await workItemsService.getItemById(req.user!, req.params.id as string);
    return sendSuccess(res, item, 200);
  } catch (error) {
    next(error);
  }
});

// 4. PATCH /api/v1/items/:id — update permitted fields with optimistic locking
workItemsRouter.patch(
  '/:id',
  validateRequest({ body: UpdateWorkItemSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await workItemsService.updateItem(req.user!, req.params.id as string, req.body);
      return sendSuccess(res, item, 200);
    } catch (error) {
      next(error);
    }
  }
);

// 5. POST /api/v1/items/:id/claim — claim an unassigned item (atomic conditional update)
workItemsRouter.post(
  '/:id/claim',
  idempotencyMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await workItemsService.claimItem(req.user!, req.params.id as string);
      return sendSuccess(res, item, 200);
    } catch (error) {
      next(error);
    }
  }
);

// 6. POST /api/v1/items/:id/transition — transition through workflow
workItemsRouter.post(
  '/:id/transition',
  idempotencyMiddleware,
  validateRequest({ body: TransitionWorkItemSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await workItemsService.transitionItem(
        req.user!,
        req.params.id as string,
        req.body
      );
      return sendSuccess(res, item, 200);
    } catch (error) {
      next(error);
    }
  }
);

// 7. GET /api/v1/items/:id/activity — retrieve item activity audit history
workItemsRouter.get('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activity = await workItemsService.getActivityHistory(req.user!, req.params.id as string);
    return sendSuccess(res, activity, 200);
  } catch (error) {
    next(error);
  }
});

// 8. POST /api/v1/items/:id/comments — add a comment
workItemsRouter.post(
  '/:id/comments',
  validateRequest({ body: AddCommentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await workItemsService.addComment(
        req.user!,
        req.params.id as string,
        req.body
      );
      return sendSuccess(res, comment, 201);
    } catch (error) {
      next(error);
    }
  }
);

// 9. GET /api/v1/items/:id/comments — retrieve item comments
workItemsRouter.get('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comments = await workItemsService.getComments(req.user!, req.params.id as string);
    return sendSuccess(res, comments, 200);
  } catch (error) {
    next(error);
  }
});
