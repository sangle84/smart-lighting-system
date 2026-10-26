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
import { CommandPublisher, CommandRepo } from './repositories/commands.js';
import { CommandController } from './controllers/commands.js';
import { createCommandRoutes } from './routes/commands.js';
import { MqttService } from './mqtt/service.js';
import { RealtimeGateway } from './realtime/gateway.js';

// Database pool
const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export function createApp(
  databasePool: Pool = pool,
  commandPublisher?: CommandPublisher
): express.Express {
  const userRepo = new UserRepo(databasePool);
  const authController = new AuthController(userRepo);
  const userController = new UserController(userRepo);
  const deviceController = new DeviceController(new DeviceRepo(databasePool));
  const operationsController = new OperationsController(new OperationsRepo(databasePool));
  const commandRepo = new CommandRepo(databasePool);
  const commandController = new CommandController(commandRepo, commandPublisher);
  const app = express();

  app.locals.setRealtimeGateway = (gateway: RealtimeGateway): void => {
    deviceController.setRealtimeGateway(gateway);
  };

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
  app.use(createCommandRoutes(commandController));

  app.use(validationErrorHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const mqttService = new MqttService(pool, new CommandRepo(pool));
  const app = createApp(pool, mqttService);
  const server = app.listen(config.PORT, () => {
    console.log(`Backend running on port ${config.PORT}`);
  });
  const realtime = new RealtimeGateway(pool, server);
  app.locals.setRealtimeGateway(realtime);
  mqttService.setRealtimeGateway(realtime);
  mqttService.connect();

  const shutdown = (): void => {
    server.close(() => {
    mqttService.close();
    void realtime.close().then(() => pool.end()).then(() => process.exit(0));
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
