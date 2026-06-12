# Quick Start Guide - After Fixes Applied

## Prerequisites
- Docker Desktop running
- All code changes from ATTENDANCE_FLOW_FIXES.md applied

## Step 1: Clean Start
```bash
# Stop everything
docker compose down

# Remove old containers
docker rm -f attendance_postgres attendance_redis attendance_backend attendance_frontend 2>/dev/null || true

# Remove old volumes (OPTIONAL - only if you want fresh data)
# docker volume rm $(docker volume ls -q | grep attendance) 2>/dev/null || true
```

## Step 2: Install Frontend Dependencies
```bash
cd frontend
npm install jsqr@^1.4.0
npm uninstall qr-scanner
cd ..
```

## Step 3: Start Services
```bash
# Build and start all services
docker compose up --build -d

# Wait for services to be healthy (30-60 seconds)
docker compose ps
```

## Step 4: Run Migrations
```bash
# Run all migrations including the new one
docker exec attendance_backend npm run migrate

# Verify migration 013 applied
docker exec attendance_postgres psql -U attendance_user -d attendance_db -c "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='attendance_records' AND column_name IN ('class_id', 'term_id');"
```

Expected output:
```
 column_name | is_nullable 
-------------+-------------
 class_id    | YES
 term_id     | YES
```

## Step 5: Seed Database (if fresh install)
```bash
docker exec attendance_backend npm run seed
```

## Step 6: Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **API Docs:** http://localhost:4000/api-docs

## Step 7: Test the Flow

### Faculty Side (Generate QR)
1. Login as faculty: `john.doe@greenfield.edu` / `Faculty@123`
2. Navigate to "Generate QR"
3. Fill in course details:
   - Course Code: TEST101
   - Course Name: Test Lecture
   - Session Type: Lecture
   - Start Time: Now
   - End Time: Now + 1 hour
   - Location: Test Room
4. Click "Start Session & Generate QR"
5. **Verify:**
   - ✅ QR code image displays
   - ✅ Token code displays below QR (long string starting with "eyJ...")
   - ✅ Countdown shows 3:00
   - ✅ Countdown bar is full
   - ✅ Token is selectable (click to select all)

### Student Side (Scan QR)
1. Open a new browser window/tab (or use phone)
2. Login as student: `alice.johnson@student.greenfield.edu` / `Student@123`
3. Navigate to "Mark Attendance"
4. **Camera Scan Test:**
   - Click "Allow" when camera permission requested
   - Point camera at the QR code on faculty screen
   - **Verify:**
     - ✅ Camera feed shows
     - ✅ Corner brackets appear
     - ✅ Scan line animates
     - ✅ QR detected within 3 seconds
     - ✅ "Validating..." overlay shows
     - ✅ Session info card appears
5. **Manual Entry Test (Alternative):**
   - Click "Enter Code" tab
   - Copy token from faculty screen
   - Paste into input field
   - Click "Validate Code"
   - **Verify:**
     - ✅ Validation succeeds
     - ✅ Session info card appears
6. **Face Capture:**
   - Click "Capture Photo"
   - Wait for 3-second countdown
   - **Verify:**
     - ✅ Photo captures automatically
     - ✅ Preview shows
     - ✅ "Use This Photo" button works
7. **Location:**
   - Click "Allow Location Access"
   - **Verify:**
     - ✅ GPS coordinates captured
     - ✅ Location confirmed (or shows distance if too far)
8. **Submit:**
   - Click "Confirm & Submit Attendance"
   - **Verify:**
     - ✅ Submitting animation shows
     - ✅ Success receipt displays
     - ✅ Receipt shows course, time, confidence

### Token Expiry Test
1. Wait 3 minutes on faculty screen
2. **Verify:**
   - ✅ Countdown reaches 0:00
   - ✅ QR auto-refreshes
   - ✅ New QR image appears
   - ✅ New token code appears
   - ✅ Countdown resets to 3:00
3. Try scanning old QR (before refresh)
4. **Verify:**
   - ✅ Error: "QR code has expired" or "QR code has been refreshed"

## Troubleshooting

### Camera Not Working
**Check browser console (F12):**
```
[QR Scanner] Starting camera...
[QR Scanner] Camera error: NotAllowedError: Permission denied
```
**Fix:** Allow camera permission in browser settings

### QR Not Scanning
**Check console:**
```
[QR Scanner] QR code detected: eyJ...
[QR] Validating token with backend: eyJ...
```
**If no "QR code detected" log:**
- QR code may be too small/blurry
- Try manual entry instead
- Check lighting conditions

### Token Validation Fails
**Check backend logs:**
```bash
docker logs attendance_backend | grep "QR"
```
**Look for:**
```
QR code generated for session: <uuid>
QR token verified for session: <uuid>
```

### Attendance Not Marked
**Check backend logs:**
```bash
docker logs attendance_backend | grep "Attendance"
```
**Look for:**
```
Starting attendance verification for student: <uuid>
QR verified, proceeding to face verification
Face verified, proceeding to geofence check
All verifications passed, marking attendance
Attendance marked successfully
```

### Migration Not Applied
```bash
# Check migration status
docker exec attendance_backend npm run migrate

# If migration 013 missing, check file exists
docker exec attendance_backend ls -la src/database/migrations/ | grep 013
```

## Verification Commands

### Check QR Expiry Setting
```bash
docker exec attendance_backend node -e "console.log(require('./dist/config').default.qr.expiryMinutes)"
```
Expected: `3`

### Check Active QR Tokens
```bash
docker exec attendance_postgres psql -U attendance_user -d attendance_db -c "SELECT id, status, EXTRACT(EPOCH FROM (expires_at - issued_at))/60 as expiry_mins FROM dynamic_qr_sessions WHERE status='active' ORDER BY issued_at DESC LIMIT 5;"
```
Expected: `expiry_mins = 3.0`

### Check Recent Attendance
```bash
docker exec attendance_postgres psql -U attendance_user -d attendance_db -c "SELECT id, status, marked_at, qr_verified, face_verified, geo_verified FROM attendance_records ORDER BY marked_at DESC LIMIT 5;"
```

### Check Geofence Radius
```bash
docker exec attendance_backend node -e "const gs = require('./dist/modules/geofence/geofence.service'); console.log('Radius:', 10);"
```

## Success Criteria

✅ **Faculty can:**
- Generate QR code
- See token code displayed
- See 3-minute countdown
- QR auto-refreshes at expiry

✅ **Student can:**
- Scan QR with camera
- Enter token manually
- Complete face capture
- Complete location check
- Mark attendance successfully

✅ **System validates:**
- QR expires after 3 minutes
- Expired QR rejected
- Duplicate submission prevented
- All 3 factors verified
- Attendance recorded in database

## Next Steps

1. Test on mobile devices (iOS Safari, Android Chrome)
2. Test with multiple students simultaneously
3. Test edge cases (poor lighting, slow network, GPS indoors)
4. Monitor logs for errors
5. Set up production environment variables
6. Enable HTTPS for production (required for camera)

## Support

If issues persist:
1. Check `ATTENDANCE_FLOW_FIXES.md` for detailed root cause analysis
2. Review browser console logs (F12)
3. Review backend logs: `docker logs attendance_backend`
4. Check database state with SQL queries above
5. Verify all files were updated correctly

---

**Ready to test!** 🚀
