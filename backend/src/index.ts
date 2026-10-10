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

// Database pool
const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

// Controllers
const userRepo = new UserRepo(pool);
const authController = new AuthController(userRepo);
const userController = new UserController(userRepo);

// Routes
const app = express();

// Middleware cơ bản
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes cơ bản
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes authentication
app.use('/auth', createAuthRoutes(authController));

// Routes user administration
app.use('/users', createUsersRoutes(userController));

// Error handlers
app.use(validationErrorHandler);
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.PORT;

const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});
