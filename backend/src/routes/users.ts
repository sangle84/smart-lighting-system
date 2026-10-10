import { Router } from 'express';
import { UserController } from '../controllers/users';
import { requireAuth, requireRole } from '../middleware/auth';

/**
 * User administration routes (Admin only)
 * - GET /users (pagination)
 * - POST /users
 * - PUT /users/:id
 * - PATCH /users/:id/status
 */
export function createUsersRoutes(userController: UserController): Router {
  const router = Router();

  // List users (Admin)
  router.get('/', requireAuth, requireRole(['ADMIN']), userController.list.bind(userController));

  // Create user (Admin)
  router.post('/', requireAuth, requireRole(['ADMIN']), userController.create.bind(userController));

  // Update user (Admin)
  router.put('/:id', requireAuth, requireRole(['ADMIN']), userController.update.bind(userController));

  // Update user status (Admin)
  router.patch('/:id/status', requireAuth, requireRole(['ADMIN']), userController.updateStatus.bind(userController));

  return router;
}
