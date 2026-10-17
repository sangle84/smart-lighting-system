import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';

import { config } from './config/env.js';
import { errorHandler, notFoundHandler, validationErrorHandler } from './errors/errorHandler.js';
import { createAuthRoutes } from './routes/auth.js';
import { createUsersRoutes } from './routes/users.js';
import { AuthController } from './controllers/auth.js';
import { UserController } from './controllers/users.js';
import { UserRepo } from './repositories/user.js';
import { DeviceRepo } from './repositories/device.js';
import { DeviceController } from './controllers/devices.js';
import { createDeviceRoutes } from './routes/devices.js';
import { OperationsRepo } from './repositories/operations.js';
import { OperationsController } from './controllers/operations.js';
import { createOperationsRoutes } from './routes/operations.js';

// Database pool
const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export function createApp(databasePool: Pool = pool): express.Express {
  const userRepo = new UserRepo(databasePool);
  const authController = new AuthController(userRepo);
  const userController = new UserController(userRepo);
  const deviceController = new DeviceController(new DeviceRepo(databasePool));
  const operationsController = new OperationsController(new OperationsRepo(databasePool));
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/auth', createAuthRoutes(authController));
  app.use('/users', createUsersRoutes(userController));
  app.use('/devices', createDeviceRoutes(deviceController));
  app.use(createOperationsRoutes(operationsController));

  app.use(validationErrorHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const app = createApp();
  const server = app.listen(config.PORT, () => {
    console.log(`Backend running on port ${config.PORT}`);
  });

  const shutdown = (): void => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
