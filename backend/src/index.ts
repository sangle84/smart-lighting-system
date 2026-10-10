import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { errorHandler, notFoundHandler, validationErrorHandler } from './errors/errorHandler.js';

const app = express();

// Middleware cơ bản
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes cơ bản
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handlers
app.use(validationErrorHandler);
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
