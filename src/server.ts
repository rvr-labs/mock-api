import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { authenticateApiKey } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check (no auth required)
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Yellow Bank Mock API is running' });
});

// Serve temp HTML with secure cookies (no auth required)
app.get('/html/index', (req: Request, res: Response) => {
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  };

  res.cookie('session_id', 'sess_' + crypto.randomUUID(), cookieOptions);
  res.cookie('csrf_token', 'csrf_' + crypto.randomUUID(), cookieOptions);
  res.cookie('device_id', 'dev_' + crypto.randomUUID(), {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yellow Bank</title>
</head>
<body>
  <h1>Yellow Bank Mock API</h1>
  <p>Temporary page served with secure cookies.</p>
</body>
</html>`);
});

// Protected API Routes
app.use('/api', authenticateApiKey, apiRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
