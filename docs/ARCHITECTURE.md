# Smart Attendance System - Architecture Documentation

## System Overview

The Smart Attendance System is a production-grade SaaS platform that implements multi-factor attendance verification using:
1. Dynamic QR Code Authentication
2. Face Recognition with Biometric Encryption
3. Geo-fencing with Anti-spoofing

## Architecture Principles

- **Clean Architecture**: Separation of concerns with modular design
- **Security First**: Encrypted biometric data, signed tokens, audit trails
- **Type Safety**: Full TypeScript implementation
- **Scalability**: Stateless API design, Redis caching, job queues
- **Observability**: Comprehensive logging and audit trails

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15 with PostGIS extension
- **ORM**: Sequelize with TypeScript decorators
- **Cache/Queue**: Redis + Bull
- **Authentication**: JWT with refresh tokens
- **Logging**: Winston with daily rotation
- **Validation**: Joi + express-validator
- **Security**: Helmet, CORS, rate limiting

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: Zustand
- **Data Fetching**: React Query
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Camera**: React Webcam

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL with PostGIS
- **Cache**: Redis
- **Reverse Proxy**: Nginx (production)

## Core Modules

### 1. Authentication Module (`backend/src/modules/auth/`)
- User registration and login
- JWT token generation and validation
- Refresh token mechanism
- Password hashing with bcrypt
- Session management

### 2. User Module (`backend/src/modules/users/`)
- User CRUD operations
- Role-based access control (RBAC)
- Profile management
- Soft delete support

### 3. Face Recognition Module (`backend/src/modules/face/`)
- **Provider Abstraction**: Pluggable face recognition providers
- **Enrollment**: Capture and encrypt face descriptors
- **Verification**: Compare captured face with enrolled template
- **Liveness Detection**: Anti-spoofing checks
- **Encryption**: All biometric data encrypted at rest

**Supported Providers**:
- Mock (development/testing)
- AWS Rekognition (configurable)
- Azure Face API (configurable)
- Custom implementations

### 4. QR Code Module (`backend/src/modules/qr/`)
- Dynamic QR generation with signed JWT
- Short-lived tokens (configurable expiry)
- Replay attack prevention with nonce
- Token refresh mechanism
- Session-specific validation

### 5. Geofence Module (`backend/src/modules/geofence/`)
- PostGIS-based location verification
- Configurable radius per session
- Anti-spoofing heuristics:
  - Accuracy validation
  - Timestamp verification
  - Coordinate sanity checks
- Distance calculation

### 6. Attendance Module (`backend/src/modules/attendance/`)
- **3-Factor Verification Pipeline**:
  1. QR token validation
  2. Face verification
  3. Geofence check
- Transactional attendance marking
- Manual override capability (faculty/admin)
- Attendance history and analytics
- Failed attempt logging

### 7. Session Module (`backend/src/modules/sessions/`)
- Class session management
- QR code lifecycle
- Live attendance tracking
- Session status management
- Faculty-specific sessions

### 8. Audit Module (`backend/src/modules/audit/`)
- Comprehensive audit logging
- All sensitive operations tracked
- Device and IP logging
- Retention policy support
- Query and reporting capabilities

## Database Schema

### Key Tables

**users**
- id (UUID, PK)
- email (unique)
- password (hashed)
- role (enum: student, faculty, admin, parent)
- studentId / facultyId (unique)
- department, program, semester
- Timestamps, soft delete

**face_enrollments**
- id (UUID, PK)
- userId (FK)
- encryptedDescriptor (encrypted biometric data)
- enrollmentConfidence
- externalFaceId (for cloud providers)
- verificationCount, lastVerifiedAt
- Timestamps, soft delete

**sessions**
- id (UUID, PK)
- facultyId (FK)
- courseCode, courseName, sessionType
- scheduledStartTime, scheduledEndTime
- actualStartTime, actualEndTime
- status (enum: scheduled, active, completed, cancelled)
- location, coordinates (PostGIS POINT)
- geofenceRadius
- currentQRToken, qrTokenExpiresAt
- presentCount, absentCount, lateCount
- Timestamps, soft delete

**attendance_records**
- id (UUID, PK)
- sessionId (FK)
- studentId (FK)
- status (enum: present, absent, late)
- markedAt
- qrVerified, qrVerifiedAt
- faceVerified, faceVerifiedAt, faceConfidence
- geofenceVerified, geofenceVerifiedAt
- studentLocation (PostGIS POINT)
- distanceFromSession
- ipAddress, deviceId, userAgent
- isManualOverride, overriddenBy, overrideReason
- failedStep, failureReason
- Timestamps, soft delete

**audit_logs**
- id (UUID, PK)
- userId (FK)
- action (enum: login, attendance_marked, etc.)
- resource, resourceId
- ipAddress, userAgent, deviceId
- changes (JSONB)
- metadata (JSONB)
- success (boolean)
- errorMessage
- timestamp

## Security Features

### 1. Biometric Data Protection
- Face descriptors encrypted with AES-256
- Encryption key from environment variables
- Never store raw face images long-term
- Secure deletion after processing

### 2. QR Code Security
- Signed JWT tokens
- Short expiry (5 minutes default)
- Nonce-based replay protection
- Session-specific validation
- Automatic token refresh

### 3. Geofence Security
- Anti-spoofing heuristics
- Accuracy validation
- Timestamp verification
- Coordinate sanity checks
- PostGIS spatial queries

### 4. Authentication & Authorization
- JWT access tokens (15 min expiry)
- Refresh tokens (7 day expiry)
- Role-based access control
- Route-level authorization
- Token refresh mechanism

### 5. Rate Limiting
- General API: 100 req/15min
- Auth endpoints: 5 req/15min
- Attendance: 10 req/5min
- Configurable per environment

### 6. Audit Trail
- All sensitive operations logged
- Device and IP tracking
- Failed attempt logging
- Retention policy (365 days default)
- Immutable audit records

## API Design

### RESTful Endpoints

**Authentication**
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login
- POST `/api/auth/refresh` - Refresh access token

**Users**
- GET `/api/users/me` - Get current user profile

**Face Enrollment**
- POST `/api/face/enroll` - Enroll face (multipart/form-data)
- GET `/api/face/enrollment-status` - Check enrollment status

**Sessions**
- POST `/api/sessions` - Create session (Faculty)
- GET `/api/sessions` - List sessions
- GET `/api/sessions/:id` - Get session details
- POST `/api/sessions/:id/start` - Start session & generate QR
- POST `/api/sessions/:id/refresh-qr` - Refresh QR code

**Attendance**
- POST `/api/attendance/mark` - Mark attendance (multipart/form-data)
- GET `/api/attendance/session/:sessionId` - Session attendance
- GET `/api/attendance/student/:studentId` - Student history
- POST `/api/attendance/manual-override` - Manual override (Faculty/Admin)

**Audit**
- GET `/api/audit/logs` - Get audit logs (Admin)

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error format:
```json
{
  "success": false,
  "error": {
    "message": "Error description"
  }
}
```

## Deployment

### Development
```bash
docker-compose up -d
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
```

### Production Considerations
1. Use production-grade secrets
2. Enable HTTPS/TLS
3. Configure proper CORS origins
4. Set up database backups
5. Configure log aggregation
6. Set up monitoring (Prometheus, Grafana)
7. Use managed Redis (ElastiCache, etc.)
8. Use managed PostgreSQL (RDS, etc.)
9. Configure CDN for frontend
10. Set up CI/CD pipeline

## Scalability

### Horizontal Scaling
- Stateless API design
- Redis for session storage
- Bull queues for background jobs
- Load balancer ready

### Database Optimization
- Indexed foreign keys
- Composite indexes on queries
- Connection pooling
- Read replicas for analytics

### Caching Strategy
- Redis for session data
- API response caching
- QR token caching
- Face enrollment caching

## Monitoring & Observability

### Logging
- Winston with daily rotation
- Structured JSON logs
- Log levels: error, warn, info, debug
- Separate error logs

### Metrics (Recommended)
- Request rate and latency
- Error rates
- Database query performance
- Cache hit rates
- Queue processing times

### Health Checks
- `/health` endpoint
- Database connectivity
- Redis connectivity
- Service dependencies

## Testing Strategy

### Unit Tests
- Service layer logic
- Utility functions
- Validation logic

### Integration Tests
- API endpoints
- Database operations
- Authentication flow

### E2E Tests
- Complete attendance flow
- User registration and login
- Session creation and management

## Future Enhancements

1. **Real-time Updates**: WebSocket for live attendance
2. **Analytics Dashboard**: Advanced reporting and insights
3. **Mobile Apps**: Native iOS/Android applications
4. **Notifications**: Email/SMS alerts for parents
5. **Biometric Alternatives**: Fingerprint, iris scan
6. **AI Improvements**: Better liveness detection
7. **Blockchain**: Immutable attendance records
8. **Multi-tenancy**: Support multiple institutions
