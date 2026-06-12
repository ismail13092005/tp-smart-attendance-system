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

const PORT = config.port;

async function start() {
  await initDatabase();
  startDailyReportScheduler();
  startSessionAutoCloseScheduler();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${config.env}]`);
    logger.info(`API docs: http://localhost:${PORT}/api-docs`);
  });
}

start().catch(err => { logger.error('Startup failed', err); process.exit(1); });

process.on('SIGTERM', () => { logger.info('SIGTERM received'); process.exit(0); });
process.on('uncaughtException',  err => { logger.error('Uncaught exception',  err); process.exit(1); });
process.on('unhandledRejection', err => { logger.error('Unhandled rejection', err); process.exit(1); });

export default app;
