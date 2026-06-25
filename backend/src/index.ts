import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import config from './config';
import { swaggerSpec } from './config/swagger';
import logger from './shared/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rate-limit.middleware';
import { attachRequestContext } from './middleware/auth.middleware';

import authRoutes       from './routes/auth.routes';
import userRoutes       from './routes/user.routes';
import sessionRoutes    from './routes/session.routes';
import attendanceRoutes from './routes/attendance.routes';
import faceRoutes       from './routes/face.routes';
import auditRoutes      from './routes/audit.routes';
import dashboardRoutes  from './routes/dashboard.routes';
import notificationRoutes from './routes/notification.routes';
import { initDatabase } from './database';
import { startDailyReportScheduler } from './modules/notifications/daily-report.scheduler';
import { startSessionAutoCloseScheduler } from './modules/sessions/session-autoclose.scheduler';

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Platform'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(attachRequestContext);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Smart Attendance API',
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

app.use('/api/', apiLimiter);

app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/sessions',   sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/face',       faceRoutes);
app.use('/api/audit',      auditRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '4000', 10);

async function runMigrations(): Promise<void> {
  const { Pool } = await import('pg');
  const fs = await import('fs');
  const path = await import('path');
  const crypto = await import('crypto');

  const pool = new Pool({ connectionString: config.database.url });
  const client = await pool.connect();
  const MIGRATIONS_DIR = path.join(__dirname, 'database', 'migrations');

  try {
    const trackingSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '000_migration_tracking.sql'), 'utf8');
    await client.query(trackingSql);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f: string) => f.endsWith('.sql') && f !== '000_migration_tracking.sql')
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE filename = $1', [file]);
      if (rows.length > 0) { logger.info(`Migration already applied: ${file}`); continue; }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename, checksum, duration_ms) VALUES ($1, $2, $3)', [file, checksum, 0]);
        await client.query('COMMIT');
        logger.info(`Migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
    logger.info('All migrations applied');
  } finally {
    client.release();
    await pool.end();
  }
}

async function start() {
  await runMigrations();
  await initDatabase();
  startDailyReportScheduler();
  startSessionAutoCloseScheduler();
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT} [${config.env}]`);
    logger.info(`API docs: http://localhost:${PORT}/api-docs`);
  });
}

start().catch(err => { logger.error('Startup failed', err); process.exit(1); });

process.on('SIGTERM', () => { logger.info('SIGTERM received'); process.exit(0); });
process.on('uncaughtException',  err => { logger.error('Uncaught exception',  err); process.exit(1); });
process.on('unhandledRejection', err => { logger.error('Unhandled rejection', err); process.exit(1); });

export default app;
