import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  env: string;
  port: number;
  database: {
    url: string;
    logging: boolean;
  };
  redis: {
    url: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiry: string;
    refreshExpiry: string;
  };
  encryption: {
    key: string;
  };
  face: {
    provider: string;
    apiKey: string;
    endpoint: string;
    confidenceThreshold: number;
    livenessEnabled: boolean;
    antiSpoofingEnabled: boolean;
  };
  qr: {
    expiryMinutes: number;
    signingSecret: string;
  };
  geofence: {
    radiusMeters: number;
    antiSpoofingEnabled: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  email: {
    provider: string;
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
  sms: {
    provider: string;
    apiKey: string;
    apiSecret: string;
    fromNumber: string;
  };
  cors: {
    origin: string;
  };
  upload: {
    maxSizeMB: number;
    path: string;
  };
  audit: {
    retentionDays: number;
  };
  logging: {
    level: string;
    fileEnabled: boolean;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://attendance_user:attendance_pass@localhost:5432/attendance_db',
    logging: process.env.NODE_ENV === 'development',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_production',
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'dev_encryption_key_32_chars_min',
  },
  face: {
    provider: process.env.FACE_SERVICE_PROVIDER || 'mock',
    apiKey: process.env.FACE_SERVICE_API_KEY || '',
    endpoint: process.env.FACE_SERVICE_ENDPOINT || '',
    confidenceThreshold: parseFloat(process.env.FACE_CONFIDENCE_THRESHOLD || '0.85'),
    livenessEnabled: process.env.FACE_LIVENESS_ENABLED === 'true',
    antiSpoofingEnabled: process.env.FACE_ANTI_SPOOFING_ENABLED === 'true',
  },
  qr: {
    expiryMinutes: parseInt(process.env.QR_TOKEN_EXPIRY_MINUTES || '3', 10),
    signingSecret: process.env.QR_SIGNING_SECRET || process.env.JWT_SECRET || 'dev_qr_secret',
  },
  geofence: {
    radiusMeters: parseInt(process.env.GEOFENCE_RADIUS_METERS || '100', 10),
    antiSpoofingEnabled: process.env.GEOFENCE_ANTI_SPOOFING_ENABLED === 'true',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@attendance.edu',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || '',
    apiKey: process.env.SMS_API_KEY || '',
    apiSecret: process.env.SMS_API_SECRET || '',
    fromNumber: process.env.SMS_FROM_NUMBER || '',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  upload: {
    maxSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    path: process.env.UPLOAD_PATH || './uploads',
  },
  audit: {
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    fileEnabled: process.env.LOG_FILE_ENABLED === 'true',
  },
};

// Validation
if (config.env === 'production') {
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ENCRYPTION_KEY',
    'DATABASE_URL',
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if (config.encryption.key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters in production');
  }
}

export default config;
