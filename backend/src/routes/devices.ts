import { Router } from 'express';
import { DeviceController } from '../controllers/devices.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export function createDeviceRoutes(controller: DeviceController): Router {
  const router = Router();
  router.get('/', requireAuth, controller.list.bind(controller));
  router.post('/', requireAuth, requireRole(['ADMIN']), controller.create.bind(controller));
  router.get('/:id', requireAuth, controller.get.bind(controller));
  router.put('/:id', requireAuth, requireRole(['ADMIN']), controller.update.bind(controller));
  router.patch(
    '/:id/lifecycle',
    requireAuth,
    requireRole(['ADMIN']),
    controller.updateLifecycle.bind(controller)
  );
  router.patch(
    '/:id/config',
    requireAuth,
    requireRole(['ADMIN']),
    controller.updateConfig.bind(controller)
  );
  router.get(
    '/:id/access',
    requireAuth,
    requireRole(['ADMIN']),
    controller.getAccess.bind(controller)
  );
  router.put(
    '/:id/access',
    requireAuth,
    requireRole(['ADMIN']),
    controller.replaceAccess.bind(controller)
  );
  router.get('/:id/telemetry/latest', requireAuth, controller.latestTelemetry.bind(controller));
  router.get('/:id/telemetry', requireAuth, controller.telemetry.bind(controller));
  return router;
}
