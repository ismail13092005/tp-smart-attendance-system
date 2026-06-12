# API Documentation

Base URL: `http://localhost:4000/api`

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description"
  }
}
```

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "student@university.edu",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "student",
  "studentId": "STU001",
  "department": "Computer Science"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "student@university.edu",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student"
    }
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "student@university.edu",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_access_token"
  }
}
```

### Users

#### Get Current User
```http
GET /users/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "student@university.edu",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "studentId": "STU001",
      "department": "Computer Science"
    }
  }
}
```

### Face Enrollment

#### Enroll Face
```http
POST /face/enroll
Authorization: Bearer <token>
Content-Type: multipart/form-data

faceImage: <image_file>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enrollment": {
      "id": "uuid",
      "confidence": 0.95
    }
  },
  "message": "Face enrolled successfully"
}
```

#### Check Enrollment Status
```http
GET /face/enrollment-status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasEnrollment": true
  }
}
```

### Sessions

#### Create Session (Faculty Only)
```http
POST /sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "courseCode": "CS101",
  "courseName": "Introduction to Programming",
  "sessionType": "lecture",
  "scheduledStartTime": "2024-01-15T10:00:00Z",
  "scheduledEndTime": "2024-01-15T12:00:00Z",
  "location": "Room 101, Main Building",
  "latitude": 42.3601,
  "longitude": -71.0942,
  "geofenceRadius": 100,
  "expectedStudents": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "courseCode": "CS101",
      "courseName": "Introduction to Programming",
      "status": "scheduled",
      ...
    }
  }
}
```

#### Get Sessions
```http
GET /sessions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "courseCode": "CS101",
        "courseName": "Introduction to Programming",
        "status": "scheduled",
        ...
      }
    ]
  }
}
```

#### Get Session Details
```http
GET /sessions/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "courseCode": "CS101",
      "courseName": "Introduction to Programming",
      "status": "active",
      "presentCount": 45,
      "lateCount": 3,
      "absentCount": 2,
      ...
    }
  }
}
```

#### Start Session (Faculty Only)
```http
POST /sessions/:id/start
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": { ... },
    "qrCode": {
      "qrCodeDataURL": "data:image/png;base64,...",
      "token": "signed_jwt_token",
      "expiresAt": "2024-01-15T10:05:00Z"
    }
  }
}
```

#### Refresh QR Code (Faculty Only)
```http
POST /sessions/:id/refresh-qr
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": {
      "qrCodeDataURL": "data:image/png;base64,...",
      "token": "new_signed_jwt_token",
      "expiresAt": "2024-01-15T10:10:00Z"
    }
  }
}
```

### Attendance

#### Mark Attendance (Student Only)
```http
POST /attendance/mark
Authorization: Bearer <token>
Content-Type: multipart/form-data

qrToken: <scanned_qr_token>
faceImage: <image_file>
latitude: 42.3601
longitude: -71.0942
accuracy: 10
deviceId: <optional_device_id>
```

**Verification Process:**
1. QR token is validated
2. Face is verified against enrollment
3. Location is checked against geofence

**Success Response:**
```json
{
  "success": true,
  "data": {
    "attendance": {
      "id": "uuid",
      "sessionId": "uuid",
      "studentId": "uuid",
      "status": "present",
      "markedAt": "2024-01-15T10:02:00Z",
      "qrVerified": true,
      "faceVerified": true,
      "faceConfidence": 0.92,
      "geofenceVerified": true,
      "distanceFromSession": 45
    }
  },
  "message": "Attendance marked successfully"
}
```

**Error Response (Verification Failed):**
```json
{
  "success": false,
  "error": {
    "message": "Face verification failed",
    "failedCheck": "face"
  }
}
```

#### Get Session Attendance (Faculty/Admin)
```http
GET /attendance/session/:sessionId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "attendance": [
      {
        "id": "uuid",
        "student": {
          "id": "uuid",
          "firstName": "John",
          "lastName": "Doe",
          "studentId": "STU001"
        },
        "status": "present",
        "markedAt": "2024-01-15T10:02:00Z",
        "faceConfidence": 0.92,
        "distanceFromSession": 45
      }
    ]
  }
}
```

#### Get Student Attendance History
```http
GET /attendance/student/:studentId?startDate=2024-01-01&endDate=2024-01-31&courseCode=CS101
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "attendance": [
      {
        "id": "uuid",
        "session": {
          "courseCode": "CS101",
          "courseName": "Introduction to Programming",
          "scheduledStartTime": "2024-01-15T10:00:00Z"
        },
        "status": "present",
        "markedAt": "2024-01-15T10:02:00Z"
      }
    ]
  }
}
```

#### Manual Attendance Override (Faculty/Admin)
```http
POST /attendance/manual-override
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "uuid",
  "studentId": "uuid",
  "status": "present",
  "reason": "Technical issue during class"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "attendance": {
      "id": "uuid",
      "status": "present",
      "isManualOverride": true,
      "overrideReason": "Technical issue during class"
    }
  },
  "message": "Attendance override successful"
}
```

### Audit Logs

#### Get Audit Logs (Admin Only)
```http
GET /audit/logs?limit=100&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "uuid",
        "action": "attendance_marked",
        "resource": "attendance",
        "resourceId": "uuid",
        "success": true,
        "timestamp": "2024-01-15T10:02:00Z",
        "ipAddress": "192.168.1.1",
        "metadata": { ... }
      }
    ],
    "total": 1000
  }
}
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate resource |
| 422 | Unprocessable Entity - Verification failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| General API | 100 requests per 15 minutes |
| Authentication | 5 requests per 15 minutes |
| Attendance Marking | 10 requests per 5 minutes |

## Attendance Verification Flow

```
1. Student scans QR code from faculty's screen
   ↓
2. Student captures face photo
   ↓
3. Student allows location access
   ↓
4. Backend verifies:
   a. QR token is valid and not expired
   b. Face matches enrolled template
   c. Location is within geofence
   ↓
5. If ALL checks pass → Attendance marked
   If ANY check fails → Attendance rejected with reason
```

## Security Notes

1. **QR Tokens**: Valid for 5 minutes, contain nonce for replay protection
2. **Face Data**: Encrypted at rest, never stored as raw images
3. **Location**: Anti-spoofing heuristics applied
4. **Audit Trail**: All operations logged with device/IP information
5. **Rate Limiting**: Prevents abuse and brute force attacks

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student1@university.edu","password":"Student@123"}'
```

### Get Current User
```bash
curl -X GET http://localhost:4000/api/users/me \
  -H "Authorization: Bearer <your_token>"
```

### Create Session (Faculty)
```bash
curl -X POST http://localhost:4000/api/sessions \
  -H "Authorization: Bearer <faculty_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "courseCode": "CS101",
    "courseName": "Programming",
    "sessionType": "lecture",
    "scheduledStartTime": "2024-01-20T10:00:00Z",
    "scheduledEndTime": "2024-01-20T12:00:00Z",
    "location": "Room 101",
    "latitude": 42.3601,
    "longitude": -71.0942,
    "geofenceRadius": 100
  }'
```
