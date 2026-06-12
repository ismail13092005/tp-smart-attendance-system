# Smart Attendance System - Quick Reference Guide

This document provides a quick reference to the complete specification.

## Document Structure

The complete specification is organized into 15 major sections:

1. **Product Requirements Document** - Executive summary, problem statement, solution overview
2. **User Stories by Role** - Detailed user stories for Student, Faculty, Admin, Parent
3. **Functional Requirements** - All system functionality requirements (FR-XXX-NNN format)
4. **Non-Functional Requirements** - Performance, availability, reliability, usability
5. **Security Requirements** - Authentication, authorization, data security, biometric security
6. **AI/Face Verification Requirements** - Face recognition provider specs, accuracy requirements
7. **Geofencing Requirements** - Location capture, verification, anti-spoofing
8. **QR Session Lifecycle Requirements** - QR generation, validation, refresh, lifecycle
9. **Deployment Requirements** - Environment, infrastructure, CI/CD, monitoring
10. **Risks and Mitigations** - Technical, security, privacy, operational, business risks
11. **Acceptance Criteria** - MVP and Production v1.0 acceptance criteria
12. **Architecture Diagrams** - System architecture, sequence diagrams, ER diagrams (Mermaid)
13. **Technical Specifications** - API modules, database entities, frontend pages, tech stack
14. **End-to-End Flows** - Complete flows, failure scenarios, edge cases
15. **Privacy and Compliance** - Data protection, GDPR, consent management, analytics

## Key Requirements Summary

### Core Attendance Rule
**Attendance is marked ONLY if ALL 3 checks pass:**
1. ✅ QR Code Scan - Valid, not expired, session active
2. ✅ Face Verification - Confidence >= 0.85, liveness passed
3. ✅ Geofence Check - Within configured radius, anti-spoofing passed

### Critical Security Requirements
- Biometric data encrypted with AES-256
- QR tokens signed with JWT, 5-minute expiry
- Rate limiting on all endpoints
- Complete audit trail
- HTTPS/TLS in production

### Performance Targets
- API response: < 200ms (95th percentile)
- Attendance marking: < 5 seconds end-to-end
- Face verification: < 3 seconds
- System uptime: 99.9%

### Accuracy Targets
- False Acceptance Rate: < 0.1%
- False Rejection Rate: < 2%
- Liveness detection: > 98%
- Anti-spoofing: > 95%

## User Roles and Permissions

| Role | Key Permissions |
|------|----------------|
| Student | Mark attendance, view history, enroll face |
| Faculty | Create sessions, generate QR, monitor attendance, manual override |
| Admin | System analytics, user management, audit logs, approve overrides |
| Parent | View linked student attendance, receive alerts |

## Technology Stack

### Backend
- Node.js 18+ + TypeScript 5.3+
- Express.js 4.18+
- PostgreSQL 15+ with PostGIS 3.3+
- Redis 7+
- JWT authentication

### Frontend
- React 18.2+ + TypeScript 5.3+
- Vite 5.0+
- Tailwind CSS 3.4+
- React Query 5.17+
- Zustand 4.4+

## API Endpoints Quick Reference

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token

### Face Management
- `POST /api/face/enroll` - Enroll face
- `GET /api/face/enrollment-status` - Check enrollment

### Session Management
- `POST /api/sessions` - Create session
- `POST /api/sessions/:id/start` - Start session & generate QR
- `POST /api/sessions/:id/refresh-qr` - Refresh QR code

### Attendance
- `POST /api/attendance/mark` - Mark attendance (3-factor)
- `GET /api/attendance/session/:id` - Get session attendance
- `GET /api/attendance/student/:id` - Get student history
- `POST /api/attendance/manual-override` - Manual override

## Database Tables

1. **users** - User accounts and profiles
2. **face_enrollments** - Encrypted biometric data
3. **sessions** - Class sessions with location
4. **attendance_records** - Attendance marks with verification details
5. **audit_logs** - Complete audit trail

## Failure Scenarios

### QR Code Expired
- Error: "QR code has expired"
- Recovery: Faculty refreshes QR

### Face Not Recognized
- Error: "Face verification failed"
- Recovery: Retake photo or manual override

### Outside Geofence
- Error: "You are outside the class location"
- Recovery: Move closer or manual override

### GPS Unavailable
- Error: "Unable to get location"
- Recovery: Move to better signal area or manual override

### System Downtime
- Error: "System temporarily unavailable"
- Recovery: Wait and retry, or manual attendance

## Manual Override Policy

**When Allowed:**
- Technical issues (GPS, camera, system)
- Legitimate disputes
- Special accommodations
- Emergency situations

**Process:**
1. Student requests from faculty
2. Faculty verifies presence
3. Faculty marks manually with reason
4. System flags as override
5. Admin can review

## Privacy Compliance

### Data Collected
- ✅ Face descriptors (encrypted)
- ✅ Location during attendance (not continuous)
- ✅ Attendance records
- ✅ Audit logs

### Data NOT Collected
- ❌ Raw face images (deleted after processing)
- ❌ Continuous location tracking
- ❌ Unnecessary personal data

### User Rights (GDPR)
- Right to access data
- Right to rectification
- Right to erasure
- Right to restrict processing
- Right to data portability

## Acceptance Criteria Checklist

### MVP (Minimum Viable Product)
- [ ] Core 3-factor attendance flow working
- [ ] User registration and login
- [ ] Face enrollment
- [ ] Session creation and management
- [ ] Attendance history
- [ ] Basic security implemented

### Production v1.0
- [ ] All MVP features
- [ ] Performance targets met
- [ ] 99.9% uptime
- [ ] Complete monitoring
- [ ] Full documentation
- [ ] 80% test coverage
- [ ] Admin features complete
- [ ] Parent features complete
- [ ] GDPR compliance
- [ ] Zero-downtime deployment

## Development Workflow

```bash
# Setup
git clone <repo>
cd smart-attendance-system
cp .env.example .env
docker-compose up -d

# Initialize
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed

# Access
Frontend: http://localhost:3000
Backend: http://localhost:4000
```

## Demo Credentials

After seeding:
- **Admin**: admin@university.edu / Admin@123456
- **Faculty**: john.doe@university.edu / Faculty@123
- **Student**: student1@university.edu / Student@123
- **Parent**: parent@example.com / Parent@123

## Support and Documentation

- **Complete Spec**: `docs/COMPLETE_SPECIFICATION.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **API Docs**: `docs/API.md`
- **Deployment**: `docs/DEPLOYMENT.md`
- **README**: `README.md`

## Key Diagrams

All diagrams are in Mermaid format in the complete specification:
- System Architecture Diagram
- Attendance Flow Sequence Diagram
- Face Enrollment Flow Diagram
- Database ER Diagram
- Component Architecture Diagram

## Contact

For questions about this specification:
- Review complete specification document
- Check architecture documentation
- Consult API documentation
- Review deployment guide

---

**Last Updated:** April 12, 2026  
**Version:** 1.0  
**Status:** Approved for Implementation
