import { Router } from 'express';
import { AuthController } from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

/**
 * Authentication routes
 * - POST /auth/login
 * - POST /auth/refresh
 * - POST /auth/logout
 * - PUT /auth/password
 */
export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Login (public)
  router.post('/login', authController.login.bind(authController));

  // Refresh token (public, verify cookie)
  router.post('/refresh', authController.refresh.bind(authController));

  // Logout (authenticated)
  router.post('/logout', requireAuth, authController.logout.bind(authController));

  // Change password (authenticated)
  router.put('/password', requireAuth, authController.changePassword.bind(authController));

  return router;
}
