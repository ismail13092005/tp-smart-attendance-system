<div align="center">

# SmartAttend — Automated Attendance System

**A production-ready, multi-factor attendance verification platform for colleges and universities.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

[Features](#-features) · [Quick Start](#-quick-start) · [Demo Credentials](#-demo-credentials) · [API Docs](#-api-documentation) · [Contact](#-contact)

</div>

---

## Overview

SmartAttend eliminates manual attendance taking by combining **QR code scanning**, **face recognition**, and **GPS geofencing** into a seamless 3-factor verification flow. Faculty generate a live QR code; students scan it, take a selfie, and confirm their location — all in under 30 seconds.

| Role | What they get |
|------|--------------|
| **Faculty** | Generate QR sessions, live attendance sheet, manual overrides, PDF/CSV reports |
| **Student** | Scan QR, face verify, mark attendance, view history, download PDF report |
| **Admin** | University-wide analytics, faculty monitoring, branch data, search |
| **Parent** | Daily 6 PM attendance digest, child attendance history |

---

## Features

- **3-Factor Verification** — QR code + Face recognition + GPS geofence
- **Real-time QR Scanner** — Camera-based scanning in the browser (no app needed)
- **Auto-expiring QR** — 10-minute expiry with auto-refresh countdown
- **Live GPS Capture** — Faculty location captured at session start; students must be within 50m
- **Face Enrollment** — Encrypted biometric templates, raw photos never stored
- **Live Attendance Sheet** — Real-time student list with verification badges
- **Manual Override** — Override any student's status with audited reason
- **Defaulters List** — Students below 75% attendance threshold
- **PDF & CSV Export** — Professional attendance reports for both portals
- **Daily Parent Digest** — Automated 6 PM notification: attended vs missed lectures
- **Role-based Access** — Student / Faculty / Admin / Parent portals
- **Audit Logs** — Every sensitive action logged with IP and timestamp

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React + Vite)                 │
│  Student | Faculty | Admin | Parent  ←→  REST API   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / JWT
┌──────────────────────▼──────────────────────────────┐
│              Backend (Node.js + Express)              │
│  Auth | Sessions | Attendance | Face | Geofence      │
└──────────┬────────────────────────────┬─────────────┘
           │                            │
┌──────────▼──────────┐    ┌────────────▼────────────┐
│ PostgreSQL + PostGIS │    │         Redis            │
└─────────────────────┘    └─────────────────────────┘
```

**Tech Stack**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 15 + PostGIS, Redis 7 |
| Auth | JWT access + refresh tokens, bcrypt |
| Face Recognition | Mock (dev) / AWS Rekognition / Azure Face (prod) |
| PDF Export | jsPDF + jspdf-autotable |
| QR Scanning | qr-scanner (camera-based) |
| Containerization | Docker + Docker Compose |

---

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Clone

```bash
git clone https://github.com/ismail13092005/Automated-Attendance-System-for-College-Students-main-2.git
cd Automated-Attendance-System-for-College-Students-main-2
```

### 2. Start all services

```bash
docker compose up
```

- **Frontend** → http://localhost:3000
- **Backend API** → http://localhost:4000
- **API Docs** → http://localhost:4000/api-docs

> First run takes ~5 minutes to pull images and install dependencies.

### 3. Run migrations + seed

```bash
docker exec attendance_backend npm run migrate
docker exec attendance_backend npm run seed
```

### 4. Open the app

Go to **http://localhost:3000** and log in with any demo credential below.

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@greenfield.edu` | `Admin@123456` |
| Faculty | `john.doe@greenfield.edu` | `Faculty@123` |
| Student | `alice.johnson@student.greenfield.edu` | `Student@123` |
| Parent | `robert.johnson@gmail.com` | `Parent@123` |

> 12 students, 4 faculty, 4 parents, and historical attendance data are pre-loaded.

---

## How to Mark Attendance (End-to-End)

1. **Faculty** logs in → Generate QR → fills course details → clicks **Start Session & Generate QR**
   - Browser asks for location permission — allow it
   - QR code appears with 10-minute countdown

2. **Student** logs in → Mark Attendance
   - **Step 1**: Scan the QR code shown on faculty screen
   - **Step 2**: Take a selfie for face verification
   - **Step 3**: Allow location access — system checks you are within 50m
   - Attendance marked — receipt shown

3. **Faculty** sees the student appear in the live attendance sheet instantly

---

## Project Structure

```
smart-attendance-system/
├── frontend/                  # React + Vite SPA
│   └── src/
│       ├── pages/             # Role-based pages
│       ├── components/        # Reusable UI components
│       ├── hooks/             # React Query data hooks
│       ├── lib/               # API client, PDF export, utilities
│       └── stores/            # Zustand state management
│
├── backend/                   # Express REST API
│   └── src/
│       ├── routes/            # API route handlers
│       ├── modules/           # Feature modules
│       ├── middleware/        # Auth, validation, rate limiting
│       ├── database/          # Migrations, seed, pool
│       └── shared/            # Types, errors, permissions
│
├── docs/                      # Architecture and API documentation
├── docker-compose.yml
└── README.md
```

---

## Configuration

Copy `.env.example` to `.env`:

```env
DATABASE_URL=postgresql://attendance_user:attendance_pass@localhost:5432/attendance_db
JWT_SECRET=your_jwt_secret_min_32_characters_long
JWT_REFRESH_SECRET=your_refresh_secret_min_32_characters_long
FACE_SERVICE_PROVIDER=mock
QR_TOKEN_EXPIRY_MINUTES=10
ENCRYPTION_KEY=your_encryption_key_32_chars_min_ok
```

---

## API Documentation

Interactive Swagger docs at **http://localhost:4000/api-docs**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login and get JWT tokens |
| `POST` | `/api/sessions` | Create a new session |
| `POST` | `/api/sessions/:id/start` | Start session and generate QR |
| `POST` | `/api/attendance/mark` | Mark attendance (3-factor) |
| `GET` | `/api/dashboard/student/:id` | Student dashboard |
| `GET` | `/api/dashboard/faculty/:id` | Faculty dashboard |
| `GET` | `/api/notifications` | Get notifications |

---

## Security

- JWT access tokens (15 min) + refresh tokens (7 days) with rotation
- bcrypt password hashing
- AES-256 encrypted face descriptors
- Rate limiting on all endpoints
- Role-based permission matrix
- Full audit trail with IP and user agent

---

## Contact

**Ismail** — [ismailmac13@gmail.com](mailto:ismailmac13@gmail.com)

GitHub: [@ismail13092005](https://github.com/ismail13092005)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
Made with love for Greenfield University · Star this repo if you find it useful!
</div>
