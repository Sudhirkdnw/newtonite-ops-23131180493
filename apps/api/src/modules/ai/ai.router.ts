import { Router, type Request, type Response, type NextFunction } from 'express';
import { AiAssistantQuerySchema, AiDraftEmailSchema } from '@newtonite/shared';
import { authenticate } from '../../middleware/authenticate';
import { aiAssistantService } from './ai-assistant.service';
import { sendSuccess } from '../../shared/http/response';
import { BadRequestError } from '../../shared/errors/AppError';

export const aiRouter = Router();

// All AI Assistant routes require valid authentication
aiRouter.use(authenticate);

/**
 * GET /api/v1/ai/status
 * Returns provider configuration and readiness status
 */
aiRouter.get('/status', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = await aiAssistantService.getAiStatus();
    sendSuccess(res, status);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ai/assistant
 * Processes an operational query using verified database context and bounded AI reasoning
 */
aiRouter.post(
  '/assistant',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = AiAssistantQuerySchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new BadRequestError(
          'Invalid AI assistant query',
          parseResult.error.flatten().fieldErrors
        );
      }

      if (!req.user) {
        throw new BadRequestError('User context missing');
      }

      const response = await aiAssistantService.processAssistantQuery(req.user, parseResult.data);
      sendSuccess(res, response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/ai/draft-email
 * Generates an editable escalation email draft without automatic dispatch
 */
aiRouter.post(
  '/draft-email',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = AiDraftEmailSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new BadRequestError(
          'Invalid email draft parameters',
          parseResult.error.flatten().fieldErrors
        );
      }

      if (!req.user) {
        throw new BadRequestError('User context missing');
      }

      const draft = await aiAssistantService.generateEmailDraft(req.user, parseResult.data);
      sendSuccess(res, draft);
    } catch (err) {
      next(err);
    }
  }
);
