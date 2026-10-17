import { Router } from 'express';
import { OperationsController } from '../controllers/operations.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export function createOperationsRoutes(controller: OperationsController): Router {
  const router = Router();
  router.get('/alerts', requireAuth, controller.alerts.bind(controller));
  router.patch(
    '/alerts/:id/acknowledge',
    requireAuth,
    requireRole(['ADMIN', 'OPERATOR']),
    controller.acknowledge.bind(controller)
  );
  router.patch(
    '/alerts/:id/resolve',
    requireAuth,
    requireRole(['ADMIN', 'OPERATOR']),
    controller.resolve.bind(controller)
  );
  router.get('/dashboard/summary', requireAuth, controller.summary.bind(controller));
  router.get('/dashboard/devices', requireAuth, controller.dashboardDevices.bind(controller));
  router.get(
    '/audit-logs',
    requireAuth,
    requireRole(['ADMIN']),
    controller.auditLogs.bind(controller)
  );
  return router;
}
