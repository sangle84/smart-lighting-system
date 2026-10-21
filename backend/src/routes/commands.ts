import { Router } from 'express';
import { CommandController } from '../controllers/commands.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export function createCommandRoutes(controller: CommandController): Router {
  const router = Router();
  router.post(
    '/devices/:id/commands',
    requireAuth,
    requireRole(['ADMIN', 'OPERATOR']),
    controller.create.bind(controller)
  );
  return router;
}
