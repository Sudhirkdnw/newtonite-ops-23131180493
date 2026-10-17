import { Router, type Request, type Response, type NextFunction } from 'express';
import { authService } from './auth.service';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../shared/validation/validate';
import { sendSuccess } from '../../shared/http/response';
import { LoginInputSchema } from '@newtonite/shared';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post(
  '/login',
  validateRequest({ body: LoginInputSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/auth/me
authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.user is guaranteed by authenticate
    const profile = await authService.getMe(req.user!.id);
    return sendSuccess(res, profile, 200);
  } catch (error) {
    next(error);
  }
});
