# All Code Changes - Complete Reference

This document contains every single code change needed to fix the Smart Attendance System.

## 1. Backend Config - QR Expiry

**File:** `backend/src/config/index.ts`

**Change:** Line 73
```typescript
// BEFORE:
expiryMinutes: parseInt(process.env.QR_TOKEN_EXPIRY_MINUTES || '5', 10),

// AFTER:
expiryMinutes: parseInt(process.env.QR_TOKEN_EXPIRY_MINUTES || '3', 10),
```

## 2. Geofence Service - Radius

**File:** `backend/src/modules/geofence/geofence.service.ts`

**Change:** Line 7
```typescript
// BEFORE:
const GEOFENCE_RADIUS_METERS = 50;

// AFTER:
const GEOFENCE_RADIUS_METERS = 10;
```

## 3. Attendance Service - Remove COALESCE Hacks

**File:** `backend/src/modules/attendance/attendance.service.ts`

**Change 1:** Lines ~140-160 (INSERT statement)
```typescript
// BEFORE:
const { rows: arRows } = await client.query(`
  INSERT INTO attendance_records (
    faculty_session_id, student_user_id, class_id, term_id,
    ...
  ) VALUES (
    $1, $2,
    COALESCE($3, (SELECT id FROM classes LIMIT 1)),
    COALESCE($4, (SELECT id FROM terms WHERE is_active = TRUE LIMIT 1)),
    ...

// AFTER:
const { rows: arRows } = await client.query(`
  INSERT INTO attendance_records (
    faculty_session_id, student_user_id, class_id, term_id,
    ...
  ) VALUES (
    $1, $2, $3, $4,
    ...
```

**Change 2:** Lines ~250-270 (manual override INSERT)
```typescript
// BEFORE:
const { rows } = await pool.query(`
  INSERT INTO attendance_records (
    faculty_session_id, student_user_id, class_id, term_id,
    ...
  ) VALUES (
    $1, $2,
    COALESCE($3, (SELECT id FROM classes LIMIT 1)),
    COALESCE($4, (SELECT id FROM terms WHERE is_active = TRUE LIMIT 1)),
    ...

// AFTER:
const { rows } = await pool.query(`
  INSERT INTO attendance_records (
    faculty_session_id, student_user_id, class_id, term_id,
    ...
  ) VALUES (
    $1, $2, $3, $4,
    ...
```

## 4. Database Migration - Nullable Session Class

**File:** `backend/src/database/migrations/012_nullable_class_id.sql` (NEW FILE)

```sql
-- =============================================================================
-- Migration 012: Make faculty_sessions.class_id nullable
-- =============================================================================
-- Ad-hoc sessions created without a linked class row need nullable class_id.

ALTER TABLE faculty_sessions
  ALTER COLUMN class_id DROP NOT NULL;
```

## 5. Database Migration - Nullable Attendance Class/Term

**File:** `backend/src/database/migrations/013_nullable_attendance_class_term.sql` (NEW FILE)

```sql
-- =============================================================================
-- Migration 013: Make attendance_records.class_id and term_id nullable
-- =============================================================================
-- Ad-hoc sessions (created without a linked class row) need to be able to
-- record attendance without a class_id or term_id.

ALTER TABLE attendance_records
  ALTER COLUMN class_id DROP NOT NULL,
  ALTER COLUMN term_id  DROP NOT NULL;
```

## 6. Frontend Package - Replace QR Scanner

**File:** `frontend/package.json`

**Change:** Lines ~15-20 (dependencies section)
```json
// BEFORE:
"jspdf": "^4.2.1",
"jspdf-autotable": "^5.0.7",
"lucide-react": "^0.303.0",
"qr-scanner": "^1.4.2",
"react": "^18.2.0",

// AFTER:
"jspdf": "^4.2.1",
"jspdf-autotable": "^5.0.7",
"jsqr": "^1.4.0",
"lucide-react": "^0.303.0",
"react": "^18.2.0",
```

## 7. QR Scan Component - Complete Rewrite

**File:** `frontend/src/components/attendance/QRScanStep.tsx`

**Action:** Replace entire file with new implementation

**Key Changes:**
- Import `jsqr` instead of `qr-scanner`
- Use canvas + requestAnimationFrame for scanning
- Add console.log debugging statements
- Use 'user' camera (front) instead of 'environment' (rear)
- Proper stream cleanup
- Better error handling

**New imports:**
```typescript
import jsQR from 'jsqr';
```

**New scanning logic:**
```typescript
const tick = useCallback(() => {
  if (!scanningRef.current || processedRef.current) return;

  const video = videoRef.current;
  const canvas = canvasRef.current;

  if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      console.log('[QR Scanner] QR code detected:', code.data.substring(0, 30) + '...');
      processedRef.current = true;
      scanningRef.current = false;
      processToken(code.data);
      return;
    }
  }

  if (scanningRef.current) {
    requestAnimationFrame(tick);
  }
}, []);
```

**See full file in previous response for complete implementation**

## 8. Faculty QR Generation - Add Token Display

**File:** `frontend/src/pages/professor/GenerateQR.tsx`

**Change 1:** Add qrToken state (Line ~40)
```typescript
// BEFORE:
const [session, setSession] = useState<Record<string, unknown> | null>(null);
const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);

// AFTER:
const [session, setSession] = useState<Record<string, unknown> | null>(null);
const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
const [qrToken, setQrToken] = useState<string | null>(null);
const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);
```

**Change 2:** Fix expiry fallback (Line ~95)
```typescript
// BEFORE:
setQrExpiresAt(new Date(started.data.qrCode?.expiresAt ?? Date.now() + 600_000));

// AFTER:
setQrToken(started.data.qrCode?.token ?? null);
setQrExpiresAt(new Date(started.data.qrCode?.expiresAt ?? Date.now() + 180_000));
```

**Change 3:** Fix refresh handler (Line ~105)
```typescript
// BEFORE:
const r = await api.refreshQR(session.id as string);
setQrDataUrl(r.data.qrCode?.qrCodeDataURL ?? null);
setQrExpiresAt(new Date(r.data.qrCode?.expiresAt ?? Date.now() + 600_000));

// AFTER:
const r = await api.refreshQR(session.id as string);
setQrDataUrl(r.data.qrCode?.qrCodeDataURL ?? null);
setQrToken(r.data.qrCode?.token ?? null);
setQrExpiresAt(new Date(r.data.qrCode?.expiresAt ?? Date.now() + 180_000));
```

**Change 4:** Fix countdown calculation (Line ~125)
```typescript
// BEFORE:
const pct = secondsLeft > 0 ? (secondsLeft / 600) * 100 : 0;

// AFTER:
const pct = secondsLeft > 0 ? (secondsLeft / 180) * 100 : 0;
```

**Change 5:** Add token display in JSX (Line ~180, after countdown div)
```typescript
{/* Token display */}
{qrToken && (
  <div className="w-full max-w-xs space-y-1.5">
    <p className="text-xs font-medium text-muted-foreground text-center">Token Code</p>
    <div className="rounded-lg bg-muted/50 border border-border p-2">
      <p className="text-xs font-mono text-foreground break-all text-center select-all">
        {qrToken}
      </p>
    </div>
    <p className="text-xs text-muted-foreground text-center">
      Students can enter this code manually if scanning fails
    </p>
  </div>
)}
```

## Installation Commands

```bash
# 1. Stop services
docker compose down

# 2. Install new frontend dependency
cd frontend
npm install jsqr@^1.4.0
npm uninstall qr-scanner
cd ..

# 3. Start services
docker compose up --build -d

# 4. Run migrations
docker exec attendance_backend npm run migrate

# 5. Verify
docker compose ps
docker logs attendance_backend | tail -20
docker logs attendance_frontend | tail -20
```

## Verification Commands

```bash
# Check QR expiry config
docker exec attendance_backend node -e "console.log(require('./dist/config').default.qr.expiryMinutes)"
# Expected: 3

# Check migration applied
docker exec attendance_postgres psql -U attendance_user -d attendance_db -c "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='attendance_records' AND column_name IN ('class_id', 'term_id');"
# Expected: both show is_nullable = YES

# Check active QR tokens
docker exec attendance_postgres psql -U attendance_user -d attendance_db -c "SELECT EXTRACT(EPOCH FROM (expires_at - issued_at))/60 as expiry_mins FROM dynamic_qr_sessions WHERE status='active' ORDER BY issued_at DESC LIMIT 1;"
# Expected: expiry_mins = 3.0
```

## Testing Checklist

After applying all changes:

1. **Faculty QR Generation:**
   - [ ] QR code displays
   - [ ] Token code displays below QR
   - [ ] Token is copyable
   - [ ] Countdown shows 3:00
   - [ ] Auto-refreshes at 0:00

2. **Student QR Scanning:**
   - [ ] Camera opens
   - [ ] QR detected in 1-3 seconds
   - [ ] Console shows detection logs
   - [ ] Validation succeeds
   - [ ] Manual entry works

3. **Face Capture:**
   - [ ] Camera opens
   - [ ] Photo captures
   - [ ] Preview works

4. **Location:**
   - [ ] GPS captured
   - [ ] 10m radius enforced

5. **Submission:**
   - [ ] All 3 factors collected
   - [ ] Attendance marked
   - [ ] Receipt displays

6. **Expiry:**
   - [ ] Token expires after 3 minutes
   - [ ] Expired token rejected
   - [ ] Error message shown

## Common Issues

### Issue: Migration fails
**Solution:** Check migration files exist in `backend/src/database/migrations/`

### Issue: jsQR not found
**Solution:** Run `npm install jsqr@^1.4.0` in frontend directory

### Issue: Camera not working
**Solution:** Check HTTPS enabled (required for camera API)

### Issue: QR still not scanning
**Solution:** Check browser console for errors, verify jsQR imported correctly

### Issue: Token not displaying
**Solution:** Verify qrToken state added and JSX updated

---

**All changes documented. Ready to apply!** ✅
