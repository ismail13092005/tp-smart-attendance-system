#!/bin/bash
# Auth integration test suite
BASE="http://localhost:4000"
PASS=0; FAIL=0

jq_val() { echo "$1" | python3 -c "import sys,json; v=json.load(sys.stdin)$2; print(str(v).lower() if isinstance(v,bool) else v)" 2>/dev/null; }

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then echo "  ✅ $label"; PASS=$((PASS+1))
  else echo "  ❌ $label — expected '$expected', got '$actual'"; FAIL=$((FAIL+1)); fi
}

echo ""; echo "━━━ Auth Integration Tests ━━━"

echo ""; echo "1. Login flows"
R=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@greenfield.edu","password":"Admin@123456"}')
ADMIN_TOKEN=$(jq_val "$R" "['data']['accessToken']")
ADMIN_REFRESH=$(jq_val "$R" "['data']['refreshToken']")
check "Admin login" "true" "$(jq_val "$R" "['success']")"
check "Admin role" "admin" "$(jq_val "$R" "['data']['user']['role']")"

R=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"alice.johnson@student.greenfield.edu","password":"Student@123"}')
STUDENT_TOKEN=$(jq_val "$R" "['data']['accessToken']")
check "Student login" "true" "$(jq_val "$R" "['success']")"

R=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@greenfield.edu","password":"WrongPass!"}')
check "Wrong password → UNAUTHORIZED" "UNAUTHORIZED" "$(jq_val "$R" "['error']['code']")"

R=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"nobody@x.com","password":"Whatever1"}')
check "Unknown email → UNAUTHORIZED" "UNAUTHORIZED" "$(jq_val "$R" "['error']['code']")"

echo ""; echo "2. Authenticated endpoints"
R=$(curl -s "$BASE/api/users/me" -H "Authorization: Bearer $ADMIN_TOKEN")
check "GET /users/me (admin)" "true" "$(jq_val "$R" "['success']")"

R=$(curl -s "$BASE/api/users/me" -H "Authorization: Bearer $STUDENT_TOKEN")
check "GET /users/me (student)" "true" "$(jq_val "$R" "['success']")"

R=$(curl -s "$BASE/api/users/me")
check "GET /users/me (no token) → UNAUTHORIZED" "UNAUTHORIZED" "$(jq_val "$R" "['error']['code']")"

echo ""; echo "3. RBAC permission matrix"
R=$(curl -s "$BASE/api/users" -H "Authorization: Bearer $ADMIN_TOKEN")
check "Admin can list users" "true" "$(jq_val "$R" "['success']")"

R=$(curl -s "$BASE/api/users" -H "Authorization: Bearer $STUDENT_TOKEN")
check "Student cannot list users → FORBIDDEN" "FORBIDDEN" "$(jq_val "$R" "['error']['code']")"

R=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"john.doe@greenfield.edu","password":"Faculty@123"}')
FACULTY_TOKEN=$(jq_val "$R" "['data']['accessToken']")
FACULTY_REFRESH=$(jq_val "$R" "['data']['refreshToken']")
R=$(curl -s "$BASE/api/users" -H "Authorization: Bearer $FACULTY_TOKEN")
check "Faculty cannot list users → FORBIDDEN" "FORBIDDEN" "$(jq_val "$R" "['error']['code']")"

echo ""; echo "4. Token refresh & replay protection"
R=$(curl -s -X POST "$BASE/api/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$FACULTY_REFRESH\"}")
NEW_REFRESH=$(jq_val "$R" "['data']['refreshToken']")
check "Refresh token rotation" "true" "$(jq_val "$R" "['success']")"

R=$(curl -s -X POST "$BASE/api/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$FACULTY_REFRESH\"}")
check "Replay old refresh → TOKEN_INVALID" "TOKEN_INVALID" "$(jq_val "$R" "['error']['code']")"

echo ""; echo "5. Session management"
R=$(curl -s "$BASE/api/auth/sessions" -H "Authorization: Bearer $ADMIN_TOKEN")
check "List sessions" "true" "$(jq_val "$R" "['success']")"
SESSION_COUNT=$(jq_val "$R" "['data']['sessions'].__len__()")
check "Has active sessions" "true" "$([ "$SESSION_COUNT" -gt 0 ] && echo true || echo false)"

echo ""; echo "6. Logout & session invalidation"
R=$(curl -s -X POST "$BASE/api/auth/logout" -H "Authorization: Bearer $STUDENT_TOKEN")
check "Logout success" "true" "$(jq_val "$R" "['success']")"

R=$(curl -s "$BASE/api/users/me" -H "Authorization: Bearer $STUDENT_TOKEN")
check "Token rejected after logout → UNAUTHORIZED" "UNAUTHORIZED" "$(jq_val "$R" "['error']['code']")"

echo ""; echo "7. Password reset (dev mode)"
R=$(curl -s -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"marie.curie@greenfield.edu"}')
check "Forgot password → 200" "true" "$(jq_val "$R" "['success']")"
RESET_TOKEN=$(jq_val "$R" "['dev']['resetToken']")

R=$(curl -s -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"nobody@nowhere.com"}')
check "Unknown email → 200 (no enumeration)" "true" "$(jq_val "$R" "['success']")"

if [ -n "$RESET_TOKEN" ] && [ "$RESET_TOKEN" != "None" ]; then
  R=$(curl -s -X POST "$BASE/api/auth/reset-password" -H "Content-Type: application/json" \
    -d "{\"token\":\"$RESET_TOKEN\",\"newPassword\":\"NewPass@789\"}")
  check "Reset password with valid token" "true" "$(jq_val "$R" "['success']")"

  R=$(curl -s -X POST "$BASE/api/auth/reset-password" -H "Content-Type: application/json" \
    -d "{\"token\":\"$RESET_TOKEN\",\"newPassword\":\"AnotherPass@1\"}")
  check "Replay reset token → TOKEN_INVALID" "TOKEN_INVALID" "$(jq_val "$R" "['error']['code']")"
fi

echo ""; echo "8. Audit log verification"
AUDIT_COUNT=$(docker compose exec -T postgres psql -U attendance_user -d attendance_db -t -c \
  "SELECT COUNT(*) FROM audit_logs;" 2>/dev/null | tr -d ' \n')
check "Audit logs exist (>10)" "true" "$([ "${AUDIT_COUNT:-0}" -gt 10 ] && echo true || echo false)"

FAILED_LOGINS=$(docker compose exec -T postgres psql -U attendance_user -d attendance_db -t -c \
  "SELECT COUNT(*) FROM audit_logs WHERE action='login' AND success=false;" 2>/dev/null | tr -d ' \n')
check "Failed logins logged" "true" "$([ "${FAILED_LOGINS:-0}" -gt 0 ] && echo true || echo false)"

echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[ $FAIL -eq 0 ] && exit 0 || exit 1
