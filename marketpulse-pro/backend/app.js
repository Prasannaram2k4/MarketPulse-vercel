import express from 'express';
import cors from 'cors';
import stockRoutes from './routes/stockRoutes.js';
import journalRoutes from './routes/journalRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { connectToDatabase } from './db.js';

const app = express();
const allowedOrigins = process.env.CORS_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', async (_req, res, next) => {
  try {
    await connectToDatabase();
    return next();
  } catch (error) {
    console.error('API database unavailable:', error);
    return res.status(503).json({
      message: 'Database unavailable. Configure MONGO_URI and allow this server to connect to MongoDB.',
    });
  }
});

app.use('/api/stock', stockRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/challenge', challengeRoutes);

app.get('/', (_req, res) => {
  res.send('MarketPulse Pro Backend is running!');
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled API error:', error);
  const status = error.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({
    message: status === 400 ? 'Invalid JSON request body' : 'Internal server error',
  });
});

export default app;
