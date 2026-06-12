import { Sequelize } from 'sequelize-typescript';
import config from '../config';
import logger from '../shared/logger';

// Register all models explicitly to avoid glob path issues in compiled JS
import { User } from '../modules/users/user.model';
import { Session } from '../modules/sessions/session.model';
import { FaceEnrollment } from '../modules/face/face-enrollment.model';
import { AttendanceRecord } from '../modules/attendance/attendance.model';
import { AuditLog } from '../modules/audit/audit-log.model';

const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  logging: config.database.logging ? (msg) => logger.debug(msg) : false,
  models: [User, Session, FaceEnrollment, AttendanceRecord, AuditLog],
  pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  define: { timestamps: true, underscored: true, paranoid: true },
});

export const initDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
};

export default sequelize;
