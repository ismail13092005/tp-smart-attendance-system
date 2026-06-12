# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- PostgreSQL 15+ with PostGIS (if not using Docker)
- Redis 7+ (if not using Docker)

## Quick Start with Docker

### 1. Clone and Configure

```bash
git clone <repository-url>
cd smart-attendance-system
cp .env.example .env
```

### 2. Update Environment Variables

Edit `.env` file with your configuration:

```bash
# Required for production
JWT_SECRET=<generate-secure-32-char-secret>
JWT_REFRESH_SECRET=<generate-secure-32-char-secret>
ENCRYPTION_KEY=<generate-secure-32-char-key>

# Optional: Configure face recognition provider
FACE_SERVICE_PROVIDER=mock  # or aws-rekognition, azure-face
FACE_SERVICE_API_KEY=<your-api-key>
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Initialize Database

```bash
# Run migrations
docker-compose exec backend npm run migrate

# Seed demo data
docker-compose exec backend npm run seed
```

### 5. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health Check: http://localhost:4000/health

## Demo Credentials

After seeding, use these credentials:

**Admin**
- Email: admin@university.edu
- Password: Admin@123456

**Faculty**
- Email: john.doe@university.edu
- Password: Faculty@123

**Student**
- Email: student1@university.edu
- Password: Student@123

**Parent**
- Email: parent@example.com
- Password: Parent@123

## Production Deployment

### 1. Security Checklist

- [ ] Generate strong secrets (32+ characters)
- [ ] Configure HTTPS/TLS certificates
- [ ] Set NODE_ENV=production
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up firewall rules
- [ ] Configure secure cookies
- [ ] Enable audit logging
- [ ] Set up database backups
- [ ] Configure log rotation

### 2. Environment Variables

```bash
# Application
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://attendance.yourdomain.com

# Database (use managed service)
DATABASE_URL=postgresql://user:pass@db-host:5432/attendance_db

# Redis (use managed service)
REDIS_URL=redis://redis-host:6379

# Secrets (generate secure values)
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
ENCRYPTION_KEY=<64-char-random-string>
QR_SIGNING_SECRET=<64-char-random-string>

# Face Recognition (configure your provider)
FACE_SERVICE_PROVIDER=aws-rekognition
FACE_SERVICE_API_KEY=<your-key>
FACE_CONFIDENCE_THRESHOLD=0.85

# Email Service
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=<your-key>
EMAIL_FROM=noreply@yourdomain.com

# SMS Service (optional)
SMS_PROVIDER=twilio
SMS_API_KEY=<your-key>
SMS_API_SECRET=<your-secret>

# CORS
CORS_ORIGIN=https://attendance.yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FILE_ENABLED=true
```

### 3. Database Setup

```bash
# Create database
createdb attendance_db

# Enable PostGIS
psql attendance_db -c "CREATE EXTENSION postgis;"

# Run migrations
npm run migrate

# (Optional) Seed initial data
npm run seed
```

### 4. Build for Production

```bash
# Backend
cd backend
npm ci --production
npm run build

# Frontend
cd frontend
npm ci
npm run build
```

### 5. Process Management

Use PM2 for process management:

```bash
# Install PM2
npm install -g pm2

# Start backend
cd backend
pm2 start dist/index.js --name attendance-backend

# Start with cluster mode
pm2 start dist/index.js --name attendance-backend -i max

# Save PM2 configuration
pm2 save
pm2 startup
```

### 6. Nginx Configuration

```nginx
# /etc/nginx/sites-available/attendance

upstream backend {
    server localhost:4000;
}

server {
    listen 80;
    server_name attendance.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name attendance.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        root /var/www/attendance/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

## Cloud Deployment

### AWS Deployment

**Services Required:**
- EC2 or ECS for application
- RDS PostgreSQL with PostGIS
- ElastiCache Redis
- S3 for file storage
- CloudFront for CDN
- Route 53 for DNS
- ACM for SSL certificates
- CloudWatch for monitoring

**Architecture:**
```
CloudFront (CDN)
    ↓
ALB (Load Balancer)
    ↓
ECS/EC2 (Application)
    ↓
RDS PostgreSQL + ElastiCache Redis
```

### Docker Production Build

```dockerfile
# backend/Dockerfile.prod
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

```dockerfile
# frontend/Dockerfile.prod
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Monitoring Setup

### 1. Application Monitoring

```bash
# Install monitoring tools
npm install prom-client express-prom-bundle

# Add to backend
import promBundle from 'express-prom-bundle';
app.use(promBundle({ includeMethod: true, includePath: true }));
```

### 2. Log Aggregation

Use ELK Stack or cloud services:
- Elasticsearch for log storage
- Logstash for log processing
- Kibana for visualization

### 3. Health Checks

```bash
# Check backend health
curl http://localhost:4000/health

# Check database connection
docker-compose exec backend npm run db:check

# Check Redis connection
docker-compose exec backend npm run redis:check
```

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump attendance_db | gzip > backup_$DATE.sql.gz

# Restore from backup
gunzip -c backup_20240101_120000.sql.gz | psql attendance_db
```

### Automated Backups

```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

## Scaling Considerations

### Horizontal Scaling

1. **Stateless Design**: Application is stateless, can scale horizontally
2. **Load Balancer**: Use ALB/NLB to distribute traffic
3. **Session Storage**: Redis for shared session storage
4. **File Storage**: S3 or similar for uploaded files

### Database Scaling

1. **Read Replicas**: For analytics and reporting
2. **Connection Pooling**: Configure appropriate pool size
3. **Indexing**: Ensure proper indexes on frequently queried columns
4. **Partitioning**: Consider table partitioning for large datasets

### Caching Strategy

1. **Redis Caching**: Cache frequently accessed data
2. **CDN**: CloudFront or similar for static assets
3. **API Response Caching**: Cache GET responses where appropriate

## Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Test connection
docker-compose exec backend npm run db:test
```

**Redis Connection Failed**
```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping
```

**Face Recognition Errors**
```bash
# Check provider configuration
echo $FACE_SERVICE_PROVIDER

# Verify API keys
echo $FACE_SERVICE_API_KEY

# Check logs
docker-compose logs backend | grep face
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check database queries
docker-compose exec postgres psql -U attendance_user -d attendance_db
SELECT * FROM pg_stat_activity;

# Check Redis memory
docker-compose exec redis redis-cli INFO memory
```

## Maintenance

### Regular Tasks

1. **Log Rotation**: Ensure logs are rotated and archived
2. **Database Vacuum**: Run VACUUM ANALYZE periodically
3. **Backup Verification**: Test backup restoration regularly
4. **Security Updates**: Keep dependencies updated
5. **Audit Log Cleanup**: Clean old audit logs per retention policy

### Update Procedure

```bash
# Pull latest changes
git pull origin main

# Update dependencies
cd backend && npm ci
cd frontend && npm ci

# Run migrations
npm run migrate

# Rebuild and restart
docker-compose build
docker-compose up -d
```

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Review documentation in `/docs`
- Check GitHub issues
- Contact support team
